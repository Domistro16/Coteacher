import { describe, expect, it } from 'vitest';
import { demoLessons, emptyProgress, validateProgressRecord, type ProgressRecord, type TryItVariant } from '@coteacher/shared';
import { activityCheckProgress, answerUnderstandingCheck } from '../apps/student/src/activity-check';

const lesson = demoLessons()[0];
const activity = lesson.concepts[1].variants.find((variant): variant is TryItVariant => variant.type === 'tryit')!;
const stamp = '2026-10-09T15:00:00Z';
const completion = { type: 'tryit-completed' as const, timestamp: stamp, conceptId: 'refraction', timelineStepId: activity.returnToStep, variantId: activity.id };
const reported = (): ProgressRecord => ({ ...emptyProgress(lesson), events: [completion] });

describe('activity completion and targeted understanding', () => {
  it('reports completion without inventing an understanding result and targets only its exact concept', () => {
    const before = activityCheckProgress(lesson, emptyProgress(lesson), activity);
    expect(before.reported).toBe(false); expect(before.latest).toBeUndefined();
    const result = activityCheckProgress(lesson, reported(), activity);
    expect(result.reported).toBe(true); expect(result.attempts).toEqual([]);
    expect(result.checks.map(item => item.conceptId)).toEqual(['refraction']);
    expect(result.step.id).toBe(activity.returnToStep);
  });
  it('does not count an older correct answer or a different concept as checking this activity', () => {
    const older = answerUnderstandingCheck(lesson, emptyProgress(lesson), 'quiz-bent', 1, stamp);
    const progress = answerUnderstandingCheck(lesson, { ...older, events: [...older.events, completion] }, lesson.quiz[0].id, 0, stamp);
    expect(activityCheckProgress(lesson, progress, activity).attempts).toEqual([]);
  });
  it('retains wrong answers and retries with exact choices, correctness and sources', () => {
    const initial = reported();
    const wrong = answerUnderstandingCheck(lesson, initial, 'quiz-bent', 0, stamp);
    const correct = answerUnderstandingCheck(lesson, wrong, 'quiz-bent', 1, stamp);
    expect(activityCheckProgress(lesson, correct, activity).attempts).toMatchObject([
      { selectedIndex: 0, correctness: false, sourceRefs: lesson.quiz[1].sourceRefs },
      { selectedIndex: 1, correctness: true, sourceRefs: lesson.quiz[1].sourceRefs },
    ]);
    expect(initial.events).toEqual([completion]); expect(wrong.events).toHaveLength(2);
    expect(validateProgressRecord(correct, lesson).valid).toBe(true);
  });
  it('restores attempt counts and latest response from persisted progress without UI state', () => {
    const progress = answerUnderstandingCheck(lesson, reported(), 'quiz-bent', 0, stamp);
    const restored = activityCheckProgress(lesson, JSON.parse(JSON.stringify(progress)), activity);
    expect(restored.attempts).toHaveLength(1); expect(restored.latest).toMatchObject({ correctness: false });
  });
  it('rejects cross-profile answer writes and progress summaries', () => {
    const other = emptyProgress(demoLessons()[1]);
    expect(() => answerUnderstandingCheck(lesson, other, 'quiz-bent', 1, stamp)).toThrow('different learner');
    expect(() => activityCheckProgress(lesson, other, activity)).toThrow('different learner');
  });
  it('rejects unavailable questions and invalid option indexes', () => {
    for (const index of [-1, .5, 2, NaN]) expect(() => answerUnderstandingCheck(lesson, reported(), 'quiz-bent', index, stamp)).toThrow('available prepared answer');
    expect(() => answerUnderstandingCheck(lesson, reported(), 'invented-check', 0, stamp)).toThrow('available prepared answer');
  });
  it('rejects changed answer correctness, indexes or citations but accepts original legacy records', () => {
    const progress = answerUnderstandingCheck(lesson, reported(), 'quiz-bent', 1, stamp);
    for (const patch of [{ correctness: false }, { selectedIndex: 99 }, { sourceRefs: ['notes-activity'] }]) {
      const changed = { ...progress, events: [completion, { ...progress.events[1], ...patch }] };
      expect(validateProgressRecord(changed, lesson).valid).toBe(false);
    }
    const legacy = { ...progress, events: [completion, { type: 'quiz-answered', timestamp: stamp, conceptId: 'refraction', quizId: 'quiz-bent', correctness: true }] };
    expect(validateProgressRecord(legacy, lesson).valid).toBe(true);
  });
  it('keeps previous attempts but makes a newly repeated activity pending again', () => {
    const prior = answerUnderstandingCheck(lesson, reported(), 'quiz-bent', 1, stamp);
    const repeated = { ...prior, events: [...prior.events, { ...completion, timestamp: '2026-10-09T15:01:00Z' }] };
    expect(activityCheckProgress(lesson, repeated, activity).attempts).toEqual([]);
    expect(repeated.events.filter(event => event.type === 'quiz-answered')).toHaveLength(1);
  });
});
