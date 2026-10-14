import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { decryptPayload, encryptPayload, profiles, initialTutorState, observedMemory, validTutorState, recordingCueAt,
  questionForCheck, checkPersonalization, mergeCheckAttempts, quizCaption, checkLensSource, type TutorCheck, type TutorCheckRequest,
  type LessonPackage, type ProgressRecord, type TutorState, type TutorReply, type TutorCitation } from '@coteacher/shared';
import type { ProgressReturnStore } from './progress-store';
import type { TutorInput, TutorProvider, GeneratedAnswer, CheckInput, GeneratedCheck } from './tutor-provider';
import Ajv2020 from 'ajv/dist/2020.js';
import liveSchema from '../schemas/live-session.schema.json' with { type: 'json' };
import type { LiveVoiceProvider } from './live-provider';
import checkSchema from '../schemas/tutor-check-request.schema.json' with { type: 'json' };
const validCheckRequest = new Ajv2020({ strict: true }).compile<TutorCheckRequest>(checkSchema);
const validLiveRequest = new Ajv2020({ strict: true }).compile(liveSchema);

/** Curated text only. Retrieved 2026-10-12; NASA SpacePlace Lenses section, updated 2026-04-13.
 * Educational reuse: https://www.nasa.gov/nasa-brand-center/images-and-media/ . No NASA logo or third-party image. */
const lensSource: TutorCitation = { sourceId: 'nasa-spaceplace-lenses', title: 'NASA SpacePlace — How Do Telescopes Work?',
  locator: 'https://spaceplace.nasa.gov/telescopes/en/#lenses', kind: 'curated',
  excerpt: 'A lens, just like in eyeglasses, bends light passing through it.' };

export function tutorSources(lesson: LessonPackage, conceptId: string, question: string): TutorCitation[] {
  const concept = lesson.concepts.find(concept => concept.id === conceptId)!;
  // Refraction questions can refer back to straight paths within the same
  // approved lesson. Supply that prerequisite as well as the paused concept.
  const concepts = [concept, ...lesson.concepts.filter(entry => entry.id !== conceptId)];
  const sources: TutorCitation[] = concepts.flatMap(entry => entry.variants).filter(variant => variant.type !== 'tryit').flatMap(variant => variant.sourceRefs.map(id => {
    const source = lesson.sources.find(source => source.id === id)!;
    return { sourceId: id + ':' + variant.id, title: source.title, locator: source.citation + ' · approved explanation ' + variant.id,
      kind: 'lesson' as const, excerpt: variant.content };
  }));
  if (conceptId === 'refraction' && /lens|lenses|eyeglasses|spectacles|telescope|glasses/i.test(question)) sources.push(lensSource);
  return sources;
}
/** Valid citations are checked against real supplied passages. This is not a guarantee of factual correctness. */
export function checkedAnswer(answer: GeneratedAnswer, input: TutorInput): { citations: TutorReply['citations']; visual: string | null } | null {
  if (answer.supported !== true || answer.safe !== true || answer.confident !== true || typeof answer.text !== 'string' || !answer.text.trim() || answer.text.length > 1800
    || !Array.isArray(answer.sourceIds) || !Array.isArray(answer.quotes) || !answer.sourceIds.length || answer.sourceIds.length > 6 || answer.sourceIds.length !== answer.quotes.length || new Set(answer.sourceIds).size !== answer.sourceIds.length
    || /(?:look|stare|point).{0,30}(?:sun|laser)|(?:mix|drink|taste).{0,30}(?:chemical|bleach|acid)|sharp knife|open flame|mains electricity/i.test(answer.text)) return null;
  const citations: TutorCitation[] = [];
  for (let index = 0; index < answer.sourceIds.length; index++) {
    const source = input.sources.find(source => source.sourceId === answer.sourceIds[index]);
    const quote = answer.quotes[index];
    if (!source || typeof quote !== 'string' || quote.trim().length < 12 || !source.excerpt.includes(quote)) return null;
    citations.push({ ...source, excerpt: quote });
  }
  if (answer.visualAssetId !== null && !input.visuals.some(visual => visual.id === answer.visualAssetId)) return null;
  return { citations: citations as TutorReply['citations'], visual: answer.visualAssetId };
}
export function checkedCheck(check: GeneratedCheck, input: CheckInput) {
  if (!check || typeof check.prompt !== 'string' || !check.prompt.trim() || check.prompt.length > 500 || typeof check.explanation !== 'string'
    || !check.explanation.trim() || check.explanation.length > 1000 || !Array.isArray(check.options) || check.options.length < 2 || check.options.length > 4
    || check.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 250) || new Set(check.options.map(o => o.trim().toLowerCase())).size !== check.options.length
    || !Number.isInteger(check.correctIndex) || check.correctIndex < 0 || check.correctIndex >= check.options.length || input.personalization.mode === 'guided' && check.options.length !== 2) return null;
  return checkedAnswer({ supported: check.supported, confident: check.confident, safe: check.safe, text: [check.prompt, ...check.options, check.explanation].join(' '), sourceIds: check.sourceIds, quotes: check.quotes, visualAssetId: null }, input);
}

/** One local worker, atomic encrypted files, durable jobs. All learners are fictional demo profiles. */
export class TutorStore {
  private serial: Promise<unknown> = Promise.resolve();
  private processing = new Set<string>();
  private tasks = new Set<Promise<void>>();
  private liveRequests = new Map<string, number[]>();
  private liveConnecting = new Set<string>();
  private checkJobs = new Map<string, Promise<unknown>>();
  constructor(private folder: string, private progress: ProgressReturnStore, readonly provider?: TutorProvider) {}
  private pin(id: string) { const profile = profiles.find(profile => profile.id === id); if (!profile) throw new Error('Unknown simulated learner.'); return profile.pin; }
  private path(id: string) { this.pin(id); return join(this.folder, `tutor-${id}.json`); }
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = this.serial.then(task, task); this.serial = next.catch(() => {}); return next;
  }
  private async read(id: string, lesson: LessonPackage, progress: ProgressRecord): Promise<TutorState> {
    let value: unknown;
    try { value = await decryptPayload(JSON.parse(await readFile(this.path(id), 'utf8')), this.pin(id)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return initialTutorState(lesson); throw error; }
    const state = value as TutorState;
    if (state.recordingId !== lesson.recording!.id) return initialTutorState(lesson);
    if (!validTutorState(value, lesson, progress)) throw new Error('Saved tutoring context failed validation. Nothing was overwritten.');
    return state;
  }
  private async write(state: TutorState) {
    await mkdir(this.folder, { recursive: true });
    const file = join(this.folder, `tutor-${randomBytes(8).toString('hex')}.tmp`);
    await writeFile(file, JSON.stringify(await encryptPayload(state, this.pin(state.studentId)))); await rename(file, this.path(state.studentId));
  }
  private async context(id: string, recordingId: string) {
    const lesson = await this.progress.lesson(id, recordingId), received = await this.progress.received(id, recordingId);
    if (!received) throw new Error('Synchronize saved learning records before asking the connected tutor.');
    return { lesson, record: received };
  }
  async submit(id: string, recordingId: string, envelope: unknown) {
    const submission = await decryptPayload(envelope, this.pin(id)) as { enabled?: boolean; retry?: boolean; progress?: unknown; liveTurns?: TutorState['liveTurns']; checkAttempts?: TutorState['checkAttempts'] };
    if (typeof submission.enabled !== 'boolean') throw new Error('Explicit connected tutoring consent is required.');
    // Existing receiver validates immutable IDs and newer state, then commits before receipt.
    const receipt = await this.progress.receive(id, recordingId, await encryptPayload(submission.progress, this.pin(id)));
    const state = await this.exclusive(async () => {
      const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
      state.enabled = submission.enabled!;
      if (submission.checkAttempts !== undefined) {
        if (!Array.isArray(submission.checkAttempts)) throw new Error('Invalid check attempt records.');
        const attempts = mergeCheckAttempts(state.checkAttempts, submission.checkAttempts);
        if (!validTutorState({ ...state, checkAttempts: attempts }, lesson, record)) throw new Error('Check attempts do not match the saved sourced checks.');
        state.checkAttempts = attempts;
      }
      state.memory = observedMemory(lesson, record, state.memory, state.checks, state.checkAttempts);
      if (submission.liveTurns !== undefined) {
        if (!Array.isArray(submission.liveTurns)) throw new Error('Invalid live conversation records.');
        const turns = [...(state.liveTurns ?? [])];
        for (const turn of submission.liveTurns) {
          const previous = turns.find(entry => entry.id === turn.id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(turn)) throw new Error('A saved conversation cannot be rewritten.');
          if (!previous && turns.length < 200) turns.push(turn);
        }
        const candidate = { ...state, liveTurns: turns };
        if (!validTutorState(candidate, lesson, record)) throw new Error('Live conversation context did not match this lesson.');
        state.liveTurns = turns;
      }
      if (state.enabled) for (const question of record.queuedQuestions) {
        if (question.answered || !question.recordedContext) continue;
        const previous = state.replies.find(reply => reply.questionId === question.id);
        if (previous && (!submission.retry || previous.status !== 'failed')) continue;
        if (state.replies.length >= 100 && !previous) break;
        const cue = recordingCueAt(lesson.recording!, question.recordedContext.positionMs);
        const reply: TutorReply = { questionId: question.id, originalText: question.text, conceptId: cue.conceptId, timelineStepId: cue.timelineStepId,
          positionMs: question.recordedContext.positionMs, status: this.provider ? 'queued' : 'failed', text: this.provider ? 'Saved. Coteacher is preparing a sourced answer.' : 'The connected tutor is not configured. Your question stays saved for your teacher.',
          citations: [], sourceRefs: [], visualAssetId: null, engine: this.provider?.engine ?? 'unavailable', model: this.provider?.model ?? '', updatedAt: new Date().toISOString(), speechBase64: null, review: 'unreviewed' };
        if (previous) Object.assign(previous, reply); else state.replies.push(reply);
      }
      await this.write(state); return state;
    });
    if (state.enabled) this.kick(id, recordingId);
    return { receipt, state: await encryptPayload(state, this.pin(id)) };
  }
  async returned(id: string, recordingId: string) {
    return encryptPayload(await this.current(id, recordingId), this.pin(id));
  }
  async current(id: string, recordingId: string) {
    const state = await this.exclusive(async () => {
      const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
      for (const reply of state.replies) if (reply.status === 'queued' && record.queuedQuestions.some(question => question.id === reply.questionId && question.answered)) {
        reply.status = 'deferred'; reply.text = 'Your teacher returned guidance for this question. Open the reviewed answer in your lesson questions.'; reply.updatedAt = new Date().toISOString();
      }
      state.memory = observedMemory(lesson, record, state.memory, state.checks, state.checkAttempts); await this.write(state); return state;
    });
    if (state.enabled) this.kick(id, recordingId); // Recovers durable queued jobs after restart.
    return state;
  }
  async disable(id: string, recordingId: string, envelope: unknown) {
    const value = await decryptPayload(envelope, this.pin(id)) as { enabled: boolean };
    if (value.enabled !== false) throw new Error('Invalid tutor consent change.');
    return this.exclusive(async () => {
      const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
      state.enabled = false; await this.write(state); return { saved: true };
    });
  }
  async check(id: string, recordingId: string, envelope: unknown) {
    const request = await decryptPayload(envelope, this.pin(id));
    if (!validCheckRequest(request)) throw new Error('The check request did not match your saved question.');
    const key = id + '/' + recordingId + '/' + JSON.stringify(request);
    const existing = this.checkJobs.get(key); if (existing) return existing;
    const job = this.createCheck(id, recordingId, request).finally(() => this.checkJobs.delete(key));
    this.checkJobs.set(key, job); return job;
  }
  private async createCheck(id: string, recordingId: string, request: TutorCheckRequest) {
    const work = await this.exclusive(async () => {
      const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
      if (!state.enabled) throw new Error('Enable connected tutoring to prepare a check for your question.');
      const question = questionForCheck(record, request);
      if (!question) throw new Error('Save and synchronize your original question before preparing its check.');
      const reply = state.replies.find(r => r.questionId === request.questionId);
      const bank = lesson.questionBank.find(q => q.id === request.questionId && q.conceptId === question.conceptId);
      const returned = record.queuedQuestions.find(q => q.id === request.questionId);
      if (reply?.review === 'flagged') throw new Error('Your teacher flagged this answer. A new check is unavailable until reviewed.');
      const answer = returned?.answered ? returned.answer : bank?.answer ?? (reply?.status === 'answered' ? reply.text : undefined);
      if (!answer) throw new Error('Your question does not have a checked answer yet. A check cannot be grounded safely.');
      const personalization = checkPersonalization(lesson, record, question.conceptId, state.checks, state.checkAttempts);
      const cached = state.checks?.find(c => c.questionId === request.questionId && c.originalText === request.originalText && c.positionMs === request.positionMs && JSON.stringify(c.personalization) === JSON.stringify(personalization));
      if (cached) return { cached: state } as const;
      if (!this.provider?.check) throw new Error('A check for your question is not available from the configured tutor.');
      if ((state.checks?.length ?? 0) >= 40 || (state.checks ?? []).filter(c => Date.parse(c.createdAt) > Date.now() - 60000).length >= 5) throw new Error('The quick-check limit was reached. Your saved checks and attempts are retained.');
      const concept = lesson.concepts.find(c => c.id === question.conceptId)!;
      const sources = tutorSources(lesson, concept.id, request.originalText);
      for (const citation of reply?.citations ?? []) if (!sources.some(s => s.sourceId === citation.sourceId)) sources.push(citation);
      // A learner may ask about the lens while paused at the prerequisite cue.
      // Keep the reviewed lens coverage with this question, not a generic quiz.
      if (/lens|lenses|eyeglasses|spectacles|telescope|glasses/i.test([request.originalText, reply?.text].join(' ')) && !sources.some(s => s.sourceId === checkLensSource.sourceId)) sources.push(checkLensSource);
      const input: CheckInput = { question: request.originalText, answer, objective: lesson.objective.text, concept: concept.title, classLevel: lesson.classLevel,
        sources, visuals: [], history: state.replies.filter(r => r.conceptId === concept.id && r.status === 'answered' && r.review !== 'flagged').slice(-4).map(r => ({ question: r.originalText, answer: r.text })),
        observations: observedMemory(lesson, record, state.memory, state.checks, state.checkAttempts).observations.filter(o => o.conceptId === concept.id).slice(-10), personalization,
        representation: lesson.visualAssets?.find(a => a.id === personalization.visualAssetId)?.title ?? null,
        previousAttempts: [
          ...record.events.flatMap(e => { const quiz = e.type === 'quiz-answered' && e.conceptId === concept.id ? lesson.quiz.find(q => q.id === e.quizId) : undefined;
            return quiz && e.type === 'quiz-answered' && e.selectedIndex !== undefined ? [{ prompt: quiz.prompt, selectedAnswer: quiz.options[e.selectedIndex], correctness: e.correctness, at: e.timestamp }] : []; }),
          ...(state.checkAttempts ?? []).flatMap(a => { const check = state.checks?.find(c => c.id === a.checkId && c.conceptId === concept.id); return check ? [{ prompt: check.prompt, selectedAnswer: check.options[a.selectedIndex], correctness: a.correctness, at: a.answeredAt }] : []; })
        ].sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).slice(-5).map(({at:_at,...attempt}) => attempt) };
      return { input, question };
    });
    if ('cached' in work) return encryptPayload(work.cached, this.pin(id));
    const generated = await this.provider!.check!(work.input), checked = checkedCheck(generated, work.input);
    if (!checked) throw new Error('There is not enough reliable source support for a check of your question. Your original question is saved.');
    let speechBase64: string | null = null;
    try { speechBase64 = Buffer.from(await this.provider!.speak(quizCaption(generated), false)).toString('base64'); }
    catch { /* Keep the sourced question readable when optional speech fails. */ }
    return this.exclusive(async () => {
      const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
      if (!state.enabled || state.replies.some(r => r.questionId === request.questionId && r.review === 'flagged')) throw new Error('The tutor permission or reviewed answer changed. This check was not saved.');
      const check: TutorCheck = { id: 'check-' + randomUUID(), questionId: request.questionId, originalText: request.originalText, ...work.question, positionMs: request.positionMs,
        prompt: generated.prompt, options: generated.options as TutorCheck['options'], correctIndex: generated.correctIndex, explanation: generated.explanation,
        citations: checked.citations as TutorCheck['citations'], sourceRefs: checked.citations.map(c => c.sourceId) as TutorCheck['sourceRefs'], personalization: work.input.personalization,
        engine: this.provider!.engine as TutorCheck['engine'], model: this.provider!.model, createdAt: new Date().toISOString(), speechBase64 };
      const candidate = { ...state, checks: [...(state.checks ?? []), check] };
      if (!validTutorState(candidate, lesson, record)) throw new Error('The sourced check did not match your learner and question context.');
      await this.write(candidate); return encryptPayload(candidate, this.pin(id));
    });
  }
  private kick(id: string, recordingId: string) {
    if (!this.provider || this.processing.has(id)) return;
    this.processing.add(id);
    const task = this.run(id, recordingId).catch(() => {}).finally(() => { this.processing.delete(id); this.tasks.delete(task); });
    this.tasks.add(task);
  }
  async idle() { await Promise.all(this.tasks); await this.serial; }
  private async saveReply(id: string, recordingId: string, result: TutorReply, expectedUpdatedAt?: string) {
    return this.exclusive(async () => {
      const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
      const stored = state.replies.find(reply => reply.questionId === result.questionId);
      if (!stored || !state.enabled || stored.review === 'flagged' || (expectedUpdatedAt ? stored.updatedAt !== expectedUpdatedAt : stored.status !== 'queued')) return false;
      Object.assign(stored, result); await this.write(state); return true;
    });
  }
  private async run(id: string, recordingId: string) {
    for (;;) {
      const work = await this.exclusive(async () => {
        const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
        const reply = state.enabled ? state.replies.find(reply => reply.status === 'queued' && reply.review !== 'flagged' && !record.queuedQuestions.some(question => question.id === reply.questionId && question.answered)) : undefined;
        if (!reply) return null;
        const recent = state.replies.filter(reply => reply.status !== 'queued' && Date.parse(reply.updatedAt) > Date.now() - 86400000);
        if (recent.length >= 20 || recent.filter(reply => Date.parse(reply.updatedAt) > Date.now() - 60000).length >= 5) {
          reply.status = 'failed'; reply.text = 'The connected tutor has reached its request limit. Your question is saved; try again later.'; await this.write(state); return { limited: true } as const;
        }
        const concept = lesson.concepts.find(concept => concept.id === reply.conceptId)!;
        const history = state.replies.filter(item => item.conceptId === reply.conceptId && item.status === 'answered' && item.review !== 'flagged').slice(-6).map(item => ({ question: item.originalText, answer: item.text }));
        const input: TutorInput = { question: reply.originalText, objective: lesson.objective.text, concept: concept.title, classLevel: lesson.classLevel,
          // A spoken follow-up may say "that" without naming the lens again.
          // Retain the same approved source coverage as the recent conversation.
          sources: tutorSources(lesson, concept.id, [reply.originalText, ...history.map(item => item.question)].join('\n')),
          visuals: (lesson.visualAssets ?? []).filter(asset => asset.conceptId === concept.id).map(asset => ({ id: asset.id, title: asset.title, annotations: asset.layers.filter(layer => layer.kind === 'text').map(layer => layer.text) })),
          history,
          observations: state.memory.observations.filter(event => event.conceptId === concept.id).slice(-10) };
        return { reply: structuredClone(reply), input };
      });
      if (!work) return; if ('limited' in work) continue;
      const result = work.reply;
      let publishedAt: string | undefined;
      try {
        const unsafe = /\b(poison|weapon|suicide|self.harm|nude|sex|electric shock|burn|laser.*eye)\b/i.test(result.originalText);
        const answer = unsafe ? null : await this.provider!.answer(work.input);
        const checked = answer && checkedAnswer(answer, work.input);
        if (!checked) { result.status = 'deferred'; result.text = 'I cannot give a reliable, safe answer from the available sources. Your original question is saved for teacher guidance.'; }
        else {
          result.status = 'answered'; result.text = answer!.text; result.citations = checked.citations; result.sourceRefs = checked.citations.map(source => source.sourceId); result.visualAssetId = checked.visual;
          // Live voice can speak checked text now; offline MP3 preparation must not delay it.
          result.updatedAt = new Date().toISOString();
          if (!await this.saveReply(id, recordingId, result)) continue;
          publishedAt = result.updatedAt;
          try { result.speechBase64 = Buffer.from(await this.provider!.speak(result.text)).toString('base64'); }
          catch { result.speechBase64 = null; } // Preserve sourced text; never pretend failed speech played.
        }
      } catch (error) { result.status = 'failed'; result.text = (error instanceof Error ? error.message : 'The connected tutor could not answer.') + ' Your question is still saved. Retry when the service is available.'; }
      result.updatedAt = new Date().toISOString();
      await this.saveReply(id, recordingId, result, publishedAt);
    }
  }
  async transcribe(id: string, recordingId: string, envelope: unknown) {
    if (!this.provider) throw new Error('Connected voice is not configured. Please type your question.');
    const value = await decryptPayload(envelope, this.pin(id)) as { audioBase64: string; mime: string; enabled: boolean };
    const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
    if (!state.enabled || value.enabled !== true || !['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].includes(value.mime)
      || typeof value.audioBase64 !== 'string' || value.audioBase64.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.audioBase64)) throw new Error('Invalid voice submission. Please type your question.');
    return encryptPayload({ text: await this.provider.transcribe(Buffer.from(value.audioBase64, 'base64'), value.mime) }, this.pin(id));
  }
  async live(id: string, recordingId: string, envelope: unknown, provider?: LiveVoiceProvider) {
    if (!provider) throw new Error('Live avatar voice is not configured. Prepared speech and text remain available.');
    const value = await decryptPayload(envelope, this.pin(id));
    if (!validLiveRequest(value)) throw new Error('Invalid live voice request.');
    const request = value as { positionMs: number; sdp: string };
    const { lesson, record } = await this.context(id, recordingId), state = await this.read(id, lesson, record);
    if (!state.enabled || request.positionMs > lesson.recording!.durationMs) throw new Error('Enable connected tutoring for this approved recorded lesson first.');
    if (this.liveConnecting.has(id)) throw new Error('Live voice is already connecting.');
    const recent = (this.liveRequests.get(id) ?? []).filter(time => time > Date.now() - 60000);
    if (recent.length >= 3) throw new Error('Please wait before starting another voice conversation. Text still works.');
    this.liveRequests.set(id, [...recent, Date.now()]); this.liveConnecting.add(id);
    try {
      const cue = recordingCueAt(lesson.recording!, request.positionMs);
      const connection = await provider.create(request.sdp, { concept: lesson.concepts.find(concept => concept.id === cue.conceptId)!.title, objective: lesson.objective.text, classLevel: lesson.classLevel });
      return encryptPayload({ ...connection, model: provider.model }, this.pin(id));
    } finally { this.liveConnecting.delete(id); }
  }
  async overview() {
    const states: TutorState[] = [];
    for (const record of await this.progress.overview()) {
      const lesson = await this.progress.lesson(record.studentId);
      const state = await this.read(record.studentId, lesson, record);
      // School-received evidence exists even when external AI was never enabled.
      // Derive locally; never grant consent or start provider work for overview.
      states.push({ ...state, memory: observedMemory(lesson, record, state.memory, state.checks, state.checkAttempts) });
    }
    return states;
  }
  async flag(id: string, questionId: string) {
    return this.exclusive(async () => {
      const lesson = await this.progress.lesson(id), { record } = await this.context(id, lesson.recording!.id), state = await this.read(id, lesson, record);
      const reply = state.replies.find(reply => reply.questionId === questionId); if (!reply) throw new Error('Unknown tutoring answer.');
      reply.review = 'flagged'; reply.speechBase64 = null; await this.write(state); return { saved: true };
    });
  }
}
