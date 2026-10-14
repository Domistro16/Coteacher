import type { LessonPackage } from './generated/lesson-package';
import type { ProgressRecord } from './generated/progress-record';
import type { CheckPersonalization, TutorCheck, TutorCheckAttempt, TutorCitation } from './generated/tutor-state';
import type { TutorCheckRequest } from './generated/tutor-check-request';

/** The existing reviewed connected lens excerpt; no new source or fetched material. */
export const checkLensSource: TutorCitation = { sourceId: 'nasa-spaceplace-lenses', title: 'NASA SpacePlace — How Do Telescopes Work?',
  locator: 'https://spaceplace.nasa.gov/telescopes/en/#lenses', kind: 'curated', excerpt: 'A lens, just like in eyeglasses, bends light passing through it.' };

/** Exact saved question identity; never a fuzzy match or a fabricated prompt. */
export function questionForCheck(progress: ProgressRecord, request: Pick<TutorCheckRequest, 'questionId' | 'originalText' | 'positionMs'>) {
  const question = progress.queuedQuestions.find(q => q.id === request.questionId && q.text === request.originalText && q.recordedContext?.positionMs === request.positionMs);
  if (question?.recordedContext) return { conceptId: question.recordedContext.conceptId, timelineStepId: question.timelineStepId };
  const event = progress.events.find(e => e.type === 'question-matched' && e.questionId === request.questionId && e.originalText === request.originalText && e.recordedContext?.positionMs === request.positionMs);
  return event?.type === 'question-matched' ? { conceptId: event.conceptId, timelineStepId: event.timelineStepId } : undefined;
}

/** Support changes with observed attempts/choices, never with a fixed learner label. */
export function checkPersonalization(lesson: LessonPackage, progress: ProgressRecord, conceptId: string, checks: readonly TutorCheck[] = [], attempts: readonly TutorCheckAttempt[] = []): CheckPersonalization {
  const events = progress.events.filter(e => e.conceptId === conceptId);
  const prepared = events.filter(e => e.type === 'quiz-answered').map(e => ({ id: e.eventId, correct: e.correctness, at: e.timestamp }));
  const generated = attempts.filter(a => checks.some(c => c.id === a.checkId && c.conceptId === conceptId)).map(a => ({ id: a.id, correct: a.correctness, at: a.answeredAt }));
  const results = [...prepared, ...generated].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-3);
  const choice = events.filter(e => e.type === 'visual-explored' && e.origin === 'learner-choice').at(-1);
  const repeats = events.filter(e => e.type === 'explain-again').slice(-2);
  const mode = results.at(-1)?.correct === false || (!results.length && repeats.length >= 2) ? 'guided'
    : results.length >= 2 && results.slice(-2).every(result => result.correct) ? 'application' : 'standard';
  const evidenceEventIds = [...results.map(r => r.id), ...(mode === 'guided' && !results.length ? repeats.map(e => e.eventId) : []), choice?.eventId].filter((id): id is string => Boolean(id));
  return { mode, evidenceEventIds: [...new Set(evidenceEventIds)].slice(-10) as CheckPersonalization['evidenceEventIds'],
    visualAssetId: choice?.type === 'visual-explored' && lesson.visualAssets?.some(asset => asset.id === choice.visualAssetId && asset.conceptId === conceptId) ? choice.visualAssetId : null,
    reason: mode === 'guided' ? 'A short question with two choices, based on your recent attempts or requests for another explanation.'
      : mode === 'application' ? 'A new example of the same idea, after your recent correct attempts.'
      : choice ? 'A short check using the representation you chose.' : 'A short check of the question you asked; there is not enough recent check evidence to change the support.' };
}

export function mergeCheckAttempts(received: readonly TutorCheckAttempt[] = [], local: readonly TutorCheckAttempt[] = []): TutorCheckAttempt[] {
  const merged = [...received];
  for (const attempt of local) {
    const existing = merged.find(a => a.id === attempt.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(attempt)) throw new Error('An existing check attempt was changed. Nothing was replaced.');
    if (!existing) merged.push(attempt);
  }
  if (merged.length > 200) throw new Error('The saved check attempt limit was reached. Existing attempts are preserved.');
  return merged;
}

export function mergeTutorChecks(received: readonly TutorCheck[] = [], local: readonly TutorCheck[] = []): TutorCheck[] {
  const merged = [...received];
  for (const check of local) {
    const existing = merged.find(c => c.id === check.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(check)) throw new Error('A saved sourced check was changed. Nothing was replaced.');
    if (!existing) merged.push(check);
  }
  if (merged.length > 40) throw new Error('The saved check limit was reached. Existing checks are preserved.');
  return merged;
}
