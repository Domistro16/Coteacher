import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { decryptPayload, encryptPayload, emptyProgress, identifyProgressEvents, validTutorState, observedMemory, initialTutorState, companionMessages, type ProgressRecord, type TutorState } from '@coteacher/shared';
import { LessonDeliveryStore } from '../delivery/store';
import { ProgressReturnStore } from '../delivery/progress-store';
import { TutorStore, checkedAnswer, tutorSources } from '../delivery/tutor-store';
import { OpenAITutor } from '../delivery/tutor-provider';
import { MockTutor, tutorPackages } from './tutor-fixture';

async function fixture(provider = new MockTutor()) {
  await mkdir(resolve('.task-tmp'), { recursive: true }); const folder = await mkdtemp(resolve('.task-tmp/tutor-test-'));
  const lessons = new LessonDeliveryStore(folder); await lessons.restore(); const packages = tutorPackages(); await lessons.publish(packages);
  const progress = new ProgressReturnStore(folder, lessons), tutor = new TutorStore(folder, progress, provider);
  return { folder, packages, tutor, progress, provider };
}
function question(record: ProgressRecord, id: string, text: string) {
  record.queuedQuestions.push({ id, text, askedAt: '2026-10-12T10:00:00Z', answered: false, timelineStepId: 'step-refraction', recordedContext: { studentId: record.studentId, lessonId: record.lessonId, conceptId: 'refraction', recordingId: 'tutor-recording', positionMs: 1300 } });
  record.events.push({ type: 'question-no-match', eventId: 'event-' + id, questionId: id, conceptId: 'refraction', timelineStepId: 'step-refraction', timestamp: '2026-10-12T10:00:00Z' });
}
async function submit(tutor: TutorStore, record: ProgressRecord, pin = '111111', retry = false) { return tutor.submit(record.studentId, 'tutor-recording', await encryptPayload({ enabled: true, retry, progress: record }, pin)); }
async function state(tutor: TutorStore, record: ProgressRecord, pin = '111111') { return await decryptPayload(await tutor.returned(record.studentId, 'tutor-recording'), pin) as TutorState; }

describe('connected tutoring and evidence-backed memory (mock provider, no network)', () => {
  it('shows received learner evidence to teachers without enabling external tutoring', async () => {
    const f = await fixture(), lesson = f.packages[1], record = emptyProgress(lesson);
    record.events.push({ type: 'visual-explored', origin: 'learner-choice', eventId: 'b-choice', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction', recordingId: 'tutor-recording', positionMs: 1300, visualAssetId: 'refraction-steps', sourceRefs: ['notes-light'] });
    await f.progress.receive(record.studentId, 'tutor-recording', await encryptPayload(record, '222222'));
    const [received] = await f.tutor.overview();
    expect(received.enabled).toBe(false);
    expect(received.memory.recommendations[0]).toMatchObject({ visualAssetId: 'refraction-steps', evidenceEventIds: ['b-choice'] });
    expect(f.provider.inputs).toHaveLength(0);
  }, 30000);
  it('keeps appended interactions visible to teachers when a tutor upload carries an older export time', async () => {
    const f = await fixture(), record = emptyProgress(f.packages[0]);
    record.exportedAt = '2026-10-12T10:00:00Z';
    const first = await f.progress.receive(record.studentId, 'tutor-recording', await encryptPayload(record, '111111'));
    record.events.push({ type: 'explain-again', eventId: 'appended', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction' });
    const next = await f.progress.receive(record.studentId, 'tutor-recording', await encryptPayload(record, '111111'));
    const received = (await f.progress.overview())[0];
    expect(received.events.map(event => event.eventId)).toEqual(['appended']);
    expect(Date.parse(received.exportedAt)).toBeGreaterThanOrEqual(Date.parse(first.acceptedAt));
    expect(next.sha256).toBe(await (await import('@coteacher/shared')).progressDigest(record));
  }, 30000);
  it('publishes checked text before slow speech finishes and does not overwrite a teacher flag when the clip arrives', async () => {
    let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    const provider = new MockTutor(), originalSpeak = provider.speak.bind(provider);
    provider.speak = async text => { await waiting; return originalSpeak(text); };
    const f = await fixture(provider), record = emptyProgress(f.packages[0]); question(record, 'slow-clip', 'Could light bend in thick water?');
    await submit(f.tutor, record);
    let received = await state(f.tutor, record);
    for (let attempt = 0; attempt < 20 && received.replies[0].status === 'queued'; attempt++) { await new Promise(resolve => setTimeout(resolve, 10)); received = await state(f.tutor, record); }
    expect(received.replies[0].status).toBe('answered'); expect(received.replies[0].speechBase64).toBeNull();
    expect(received.replies[0].citations.length).toBeGreaterThan(0);
    await f.tutor.flag(record.studentId, 'slow-clip'); release(); await f.tutor.idle();
    const after = await state(f.tutor, record); expect(after.replies[0].review).toBe('flagged'); expect(after.replies[0].speechBase64).toBeNull();
  }, 120000);
  it('recovers a durable queued job after restart and respects withdrawn consent', async () => {
    const f = await fixture(), record = emptyProgress(f.packages[0]); question(record, 'restart-job', 'A new question saved before the worker restarted');
    await f.progress.receive(record.studentId, 'tutor-recording', await encryptPayload(record, '111111'));
    const queued = initialTutorState(f.packages[0]); queued.enabled = true;
    queued.replies.push({ questionId: 'restart-job', originalText: record.queuedQuestions[0].text, conceptId: 'refraction', timelineStepId: 'step-refraction', positionMs: 1300, status: 'queued', text: 'Saved', citations: [], sourceRefs: [], visualAssetId: null, engine: 'mock', model: f.provider.model, updatedAt: '2026-10-12T10:00:00Z', speechBase64: null, review: 'unreviewed' });
    await writeFile(join(f.folder, `tutor-${record.studentId}.json`), JSON.stringify(await encryptPayload(queued, '111111')));
    const restart = new TutorStore(f.folder, f.progress, f.provider);
    await restart.disable(record.studentId, 'tutor-recording', await encryptPayload({ enabled: false }, '111111'));
    await state(restart, record); await restart.idle(); expect(f.provider.inputs).toHaveLength(0);
    await submit(restart, record); await restart.idle();
    const recovered = await state(restart, record); expect(recovered.replies[0].status).toBe('answered'); expect(f.provider.inputs).toHaveLength(1);
    expect(recovered.replies[0].sourceRefs).toEqual(recovered.replies[0].citations.map(source => source.sourceId));
  }, 120000);
  it('durably queues, resolves with sourced speech, retains context for follow-ups, deduplicates and survives restart', async () => {
    const f = await fixture(), record = emptyProgress(f.packages[0]); question(record, 'first-question', 'How does a lens bend light like water?');
    const received = await submit(f.tutor, record); expect(received.receipt.studentId).toBe(record.studentId);
    await f.tutor.idle(); const first = await state(f.tutor, record);
    expect(first.replies[0]).toMatchObject({ status: 'answered', engine: 'mock', originalText: record.queuedQuestions[0].text, conceptId: 'refraction', positionMs: 1300 });
    expect(first.replies[0].citations.length).toBeGreaterThan(0); expect(first.replies[0].speechBase64!.length).toBeGreaterThan(1000);
    expect(validTutorState(first, f.packages[0], record)).toBe(true);
    await submit(f.tutor, record); await f.tutor.idle(); expect(f.provider.inputs).toHaveLength(1);
    question(record, 'followup-question', 'Can you explain that last part again with the same example?');
    await submit(f.tutor, record); await f.tutor.idle(); expect(f.provider.inputs[1].history[0].question).toBe(record.queuedQuestions[0].text);
    expect(f.provider.inputs[1].question).toBe(record.queuedQuestions[1].text);
    expect(f.provider.inputs[1].sources.some(source => source.sourceId === 'nasa-spaceplace-lenses')).toBe(true);
    expect(f.provider.inputs[1].sources.some(source => source.sourceId === 'notes-light:light-original')).toBe(true);
    const restarted = new TutorStore(f.folder, f.progress, f.provider), restored = await state(restarted, record);
    expect(restored.replies).toHaveLength(2); expect(restored.memory.observations).toHaveLength(2);
    const bytes = await readFile(join(f.folder, `tutor-${record.studentId}.json`), 'utf8'); expect(bytes).not.toContain(record.queuedQuestions[0].text); expect(bytes).not.toContain('111111');
  }, 120000);
  it('isolates two learners and derives different recommendations from observed interactions rather than seeded labels', async () => {
    const f = await fixture(), a = emptyProgress(f.packages[0]), b = emptyProgress(f.packages[1]);
    a.events.push({ type: 'quiz-answered', eventId: 'mistake-a', timestamp: '2026-10-12T11:00:00Z', conceptId: 'refraction', quizId: f.packages[0].quiz.find(quiz => quiz.conceptId === 'refraction')!.id, correctness: false });
    b.events.push({ type: 'visual-explored', eventId: 'choice-b', timestamp: '2026-10-12T11:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction', recordingId: 'tutor-recording', positionMs: 1300, visualAssetId: 'refraction-steps', sourceRefs: ['notes-light'] });
    await submit(f.tutor, a); await submit(f.tutor, b, '222222');
    const ma = await state(f.tutor, a), mb = await state(f.tutor, b, '222222');
    expect(ma.memory.recommendations[0]).toMatchObject({ visualAssetId: 'refraction-pencil', evidenceEventIds: ['mistake-a'] });
    expect(mb.memory.recommendations[0]).toMatchObject({ visualAssetId: 'refraction-steps', evidenceEventIds: ['choice-b'] });
    expect(validTutorState(ma, f.packages[1], b)).toBe(false);
    await expect(submit(f.tutor, a, '222222')).rejects.toThrow();
    const restarted = new TutorStore(f.folder, f.progress, f.provider); expect((await state(restarted, a)).memory).toEqual(ma.memory);
  }, 120000);
  it('preserves outage questions, rejects fabricated citations and defers hazardous questions', async () => {
    const provider = new MockTutor(), f = await fixture(provider), record = emptyProgress(f.packages[0]);
    provider.fail = true; question(record, 'outage', 'A new question during an outage'); await submit(f.tutor, record); await f.tutor.idle();
    expect((await state(f.tutor, record)).replies[0].status).toBe('failed'); expect((await f.progress.overview())[0].queuedQuestions[0].answered).toBe(false);
    provider.fail = false; await submit(f.tutor, record, '111111', true); await f.tutor.idle(); expect((await state(f.tutor, record)).replies[0].status).toBe('answered');
    provider.invalidCitation = true; question(record, 'bad-citation', 'An unmatched follow-up'); await submit(f.tutor, record); await f.tutor.idle(); expect((await state(f.tutor, record)).replies[1].status).toBe('deferred');
    question(record, 'unsafe', 'Can I aim a laser at my eye?'); await submit(f.tutor, record); await f.tutor.idle(); expect((await state(f.tutor, record)).replies[2].status).toBe('deferred'); expect(provider.inputs).toHaveLength(3);
    await f.tutor.flag(record.studentId, 'outage'); expect((await state(f.tutor, record)).replies[0].review).toBe('flagged');
  }, 120000);
  it('keeps the same default without observed history and offers only curated fallback relevant to the concept', () => {
    const [lesson] = tutorPackages(), empty = emptyProgress(lesson), memory = observedMemory(lesson, empty, initialTutorState(lesson).memory);
    expect(memory.recommendations).toEqual([]); expect(memory.revision).toBe(0);
    expect(tutorSources(lesson, 'refraction', 'How do lenses work?').at(-1)?.kind).toBe('curated');
    expect(tutorSources(lesson, 'light-path', 'How do lenses work?').every(source => source.kind === 'lesson')).toBe(true);
    expect(checkedAnswer({ supported: true, safe: true, confident: true, text: 'test', sourceIds: ['invented'], quotes: ['unsupported quote'], visualAssetId: null }, { question: '', objective: '', concept: '', classLevel: '', sources: [], visuals: [], history: [], observations: [] })).toBeNull();
  });
  it('validates real-provider HTTP payloads with an injected mock transport, never calling the network', async () => {
    const requests: { path: string; body: any }[] = [];
    const transport: typeof fetch = async (url, options) => {
      requests.push({ path: String(url), body: options?.body instanceof FormData ? options.body : JSON.parse(String(options?.body)) });
      if (String(url).endsWith('responses')) return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ supported: false, confident: false, safe: true, text: '', sourceIds: [], quotes: [], visualAssetId: null }) }] }] }));
      if (String(url).endsWith('speech')) return new Response(new Uint8Array([1, 2, 3]));
      return new Response(JSON.stringify({ text: 'What is refraction?' }));
    };
    const api = new OpenAITutor('test-key-not-real', transport);
    await api.answer({ question: 'What is refraction?', objective: 'same objective', concept: 'Refraction', classLevel: 'JSS2', sources: [], visuals: [], history: [], observations: [{ eventId: 'private-event', conceptId: 'refraction', kind: 'pause', detail: 'pause' }] });
    await api.speak('A short explanation'); expect(await api.transcribe(new Uint8Array([1]), 'audio/webm')).toBe('What is refraction?');
    expect(requests[0].body.store).toBe(false); expect(requests[0].body.text.format.strict).toBe(true); expect(JSON.stringify(requests[0].body.input)).not.toContain('private-event');
    expect(requests[0].body.input.at(-1)).toEqual({ role: 'user', content: 'What is refraction?' });
    await api.answer({ question: 'Does it keep going straight?', objective: 'same objective', concept: 'Refraction', classLevel: 'JSS2', sources: [], visuals: [], observations: [],
      history: [{ question: 'How does a lens bend light?', answer: 'A lens bends passing light.' }] });
    expect(requests.at(-1)!.body.input.slice(1)).toEqual([
      { role: 'user', content: 'How does a lens bend light?' },
      { role: 'assistant', content: 'A lens bends passing light.' },
      { role: 'user', content: 'Does it keep going straight?' },
    ]);
    expect(requests[1].body.model).toBe('gpt-4o-mini-tts'); expect(requests[2].body.get('model')).toBe('gpt-4o-mini-transcribe');
    expect(requests[1].body.voice).toBe('coral');
    expect(requests[1].body.input).toBe('A short explanation ' + companionMessages.understanding);
    expect(requests.filter(request => request.path.endsWith('/audio/speech'))).toHaveLength(1);
  });
  it('keeps the cached speech byte limit and rejects empty or oversized provider output', async () => {
    for (const length of [0, 700001]) {
      const api = new OpenAITutor('test-key-not-real', async () => new Response(new Uint8Array(length)));
      await expect(api.speak('A short checked explanation')).rejects.toThrow('download budget');
    }
    const api = new OpenAITutor('test-key-not-real', async () => new Response(new Uint8Array(700000)));
    expect((await api.speak('A short checked explanation')).length).toBe(700000);
  });
});
