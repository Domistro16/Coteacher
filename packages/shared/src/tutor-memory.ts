import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../schemas/tutor-state.schema.json' with { type: 'json' };
import type { LessonPackage } from './generated/lesson-package';
import type { ProgressRecord } from './generated/progress-record';
type ProgressEvent = ProgressRecord['events'][number];
import type { LearnerMemory, TutorState, TutorCheck, TutorCheckAttempt } from './generated/tutor-state';
import { recordingCueAt } from './recording';
import { questionForCheck, checkLensSource } from './tutor-check';

const validate = new Ajv2020({ strict: true }).compile(schema);
export function initialTutorState(lesson: LessonPackage): TutorState {
  return { enabled: false, studentId: lesson.studentId, lessonId: lesson.lessonId, recordingId: lesson.recording!.id,
    replies: [], memory: { revision: 0, observations: [], recommendations: [] } };
}
/** Observed interactions only: never infer a permanent learning type or mastery. */
function observationDetail(event: ProgressEvent): string {
  return event.type === 'quiz-answered' ? (event.correctness ? 'Correct attempt' : 'Incorrect attempt')
    : event.type === 'visual-explored' ? event.visualAssetId : event.type === 'variant-viewed' ? event.variantId : event.type;
}
export function observedMemory(lesson: LessonPackage, progress: ProgressRecord, previous: LearnerMemory, checks: readonly TutorCheck[] = [], attempts: readonly TutorCheckAttempt[] = []): LearnerMemory {
  const retained = progress.events.filter(event => event.eventId).slice(-1000);
  const observations = [...retained.map(event => ({ eventId: event.eventId!, conceptId: event.conceptId, kind: event.type, detail: observationDetail(event) })),
    ...attempts.flatMap(attempt => { const check = checks.find(c => c.id === attempt.checkId); return check ? [{ eventId: attempt.id, conceptId: check.conceptId, kind: 'tutor-check-answered', detail: attempt.correctness ? 'Correct attempt' : 'Incorrect attempt' }] : []; })].slice(-1000);
  const recommendations: { conceptId: string; visualAssetId: string; reason: string; evidenceEventIds: string[] }[] = [];
  for (const concept of lesson.concepts) {
    const events = retained.filter(event => event.conceptId === concept.id);
    const chosen = events.filter(event => event.type === 'visual-explored' && event.origin === 'learner-choice').at(-1);
    const legacy = events.filter(event => event.type === 'visual-explored' && !event.origin).at(-1);
    const latestCheck = events.filter(event => event.type === 'quiz-answered').at(-1);
    const mistakes = events.filter(event => event.type === 'quiz-answered' && !event.correctness);
    const generated = attempts.filter(a => checks.some(c => c.id === a.checkId && c.conceptId === concept.id)).at(-1);
    const generatedIsLatest = generated && (!latestCheck || Date.parse(generated.answeredAt) >= Date.parse(latestCheck.timestamp));
    const needsCheckSupport = generatedIsLatest ? !generated.correctness : latestCheck?.type === 'quiz-answered' && !latestCheck.correctness
      && (!chosen || events.indexOf(latestCheck) > events.indexOf(chosen));
    const explored = chosen ?? legacy;
    const assets = lesson.visualAssets?.filter(asset => asset.conceptId === concept.id) ?? [];
    const asset = needsCheckSupport ? assets.find(asset => /pencil|diagram/.test(asset.id))
      : explored?.type === 'visual-explored' ? assets.find(asset => asset.id === explored.visualAssetId) : undefined;
    if (asset) recommendations.push({ conceptId: concept.id, visualAssetId: asset.id,
      reason: needsCheckSupport ? 'An incorrect attempt was saved. Try the approved concrete representation before retrying.'
        : chosen ? 'You selected this representation. Try it again before the next check.' : 'You explored this representation earlier. It is available for another look.',
      evidenceEventIds: needsCheckSupport ? generatedIsLatest ? [generated.id] : mistakes.map(event => event.eventId!) : [explored!.eventId!] });
  }
  const changed = JSON.stringify({ observations, recommendations }) !== JSON.stringify({ observations: previous.observations, recommendations: previous.recommendations });
  return { revision: previous.revision + Number(changed), observations: observations.slice(-1000), recommendations: recommendations as LearnerMemory['recommendations'] };
}
export function validTutorState(value: unknown, lesson: LessonPackage, progress: ProgressRecord): value is TutorState {
  if (!validate(value)) return false;
  const state = value as unknown as TutorState;
  if (state.studentId !== lesson.studentId || state.lessonId !== lesson.lessonId || state.recordingId !== lesson.recording?.id) return false;
  const ids = new Set<string>();
  const turnIds = new Set<string>();
  for (const turn of state.liveTurns ?? []) {
    if (turnIds.has(turn.id) || turn.positionMs > lesson.recording!.durationMs || !Number.isFinite(Date.parse(turn.observedAt))
      || recordingCueAt(lesson.recording!, turn.positionMs).conceptId !== turn.conceptId
      || turn.sourceRefs.some(id => !lesson.sources.some(source => source.id === id) && !state.replies.some(reply => reply.conceptId === turn.conceptId && reply.sourceRefs.includes(id)))) return false;
    turnIds.add(turn.id);
  }
  for (const reply of state.replies) {
    const question = progress.queuedQuestions.find(question => question.id === reply.questionId);
    const cue = recordingCueAt(lesson.recording!, reply.positionMs);
    if (ids.has(reply.questionId) || !question || question.text !== reply.originalText || question.timelineStepId !== reply.timelineStepId
      || question.recordedContext?.positionMs !== reply.positionMs || cue.conceptId !== reply.conceptId || cue.timelineStepId !== reply.timelineStepId
      || reply.positionMs > lesson.recording!.durationMs) return false;
    ids.add(reply.questionId);
    if (reply.status === 'answered' && !reply.citations.length) return false;
    if (reply.sourceRefs.length !== reply.citations.length || reply.sourceRefs.some((id, index) => id !== reply.citations[index].sourceId)) return false;
    if (reply.visualAssetId && !lesson.visualAssets?.some(asset => asset.id === reply.visualAssetId && asset.conceptId === reply.conceptId)) return false;
    if (reply.speechBase64 && !/^[A-Za-z0-9+/]+={0,2}$/.test(reply.speechBase64)) return false;
  }
  const checkIds = new Set<string>(), attemptIds = new Set<string>();
  for (const check of state.checks ?? []) {
    const question = questionForCheck(progress, check), cue = recordingCueAt(lesson.recording!, check.positionMs);
    if (checkIds.has(check.id) || !question || question.conceptId !== check.conceptId || question.timelineStepId !== check.timelineStepId
      || cue.conceptId !== check.conceptId || cue.timelineStepId !== check.timelineStepId || check.positionMs > lesson.recording!.durationMs
      || check.correctIndex >= check.options.length || !Number.isFinite(Date.parse(check.createdAt))) return false;
    checkIds.add(check.id);
    if (check.sourceRefs.length !== check.citations.length || check.sourceRefs.some((id, i) => id !== check.citations[i].sourceId)) return false;
    if (check.speechBase64 && !/^[A-Za-z0-9+/]+={0,2}$/.test(check.speechBase64)) return false;
    for (const citation of check.citations) {
      if (citation.excerpt.trim().length < 12) return false;
      const supplied = state.replies.find(r => r.questionId === check.questionId)?.citations.find(c => c.sourceId === citation.sourceId);
      const variant = lesson.concepts.flatMap(c => c.variants).find(v => v.type !== 'tryit' && v.sourceRefs.some(id => id + ':' + v.id === citation.sourceId));
      const approvedSource = variant?.sourceRefs.map(id => lesson.sources.find(s => s.id === id)).find(s => s && s.id + ':' + variant.id === citation.sourceId);
      const curated = citation.sourceId === checkLensSource.sourceId && citation.title === checkLensSource.title && citation.locator === checkLensSource.locator && citation.kind === 'curated' && checkLensSource.excerpt.includes(citation.excerpt);
      if (!(supplied && supplied.title === citation.title && supplied.locator === citation.locator && supplied.kind === citation.kind && supplied.excerpt.includes(citation.excerpt))
        && !(variant && approvedSource && citation.title === approvedSource.title && citation.locator === approvedSource.citation + ' · approved explanation ' + variant.id && citation.kind === 'lesson' && variant.content.includes(citation.excerpt)) && !curated) return false;
    }
    if (check.personalization.visualAssetId && !lesson.visualAssets?.some(a => a.id === check.personalization.visualAssetId && a.conceptId === check.conceptId)) return false;
    if (!check.personalization.evidenceEventIds.every(id => progress.events.some(e => e.eventId === id && e.conceptId === check.conceptId)
      || state.checkAttempts?.some(a => a.id === id && state.checks?.some(c => c.id === a.checkId && c.conceptId === check.conceptId)))) return false;
  }
  for (const attempt of state.checkAttempts ?? []) {
    const check = state.checks?.find(c => c.id === attempt.checkId);
    if (attemptIds.has(attempt.id) || progress.events.some(e => e.eventId === attempt.id) || !check || attempt.selectedIndex >= check.options.length
      || attempt.correctness !== (attempt.selectedIndex === check.correctIndex) || !Number.isFinite(Date.parse(attempt.answeredAt))) return false;
    attemptIds.add(attempt.id);
  }
  return state.memory.observations.every(observation => progress.events.some(event => event.eventId === observation.eventId && event.conceptId === observation.conceptId
      && event.type === observation.kind && observationDetail(event) === observation.detail)
    || state.checkAttempts?.some(a => a.id === observation.eventId && observation.kind === 'tutor-check-answered' && observation.detail === (a.correctness ? 'Correct attempt' : 'Incorrect attempt')
      && state.checks?.some(c => c.id === a.checkId && c.conceptId === observation.conceptId)))
    && state.memory.recommendations.every(recommendation => lesson.visualAssets?.some(asset => asset.id === recommendation.visualAssetId && asset.conceptId === recommendation.conceptId)
      && recommendation.evidenceEventIds.length > 0 && recommendation.evidenceEventIds.every(id => state.memory.observations.some(observation => observation.eventId === id && observation.conceptId === recommendation.conceptId)));
}
