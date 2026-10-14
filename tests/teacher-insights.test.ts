import { describe, expect, it } from 'vitest';
import { demoLessons, emptyProgress, seededRecords, type ProgressEvent } from '@coteacher/shared';
import { describeInsightEvent, lessonInsights } from '../apps/teacher/src/insights';

const lesson = demoLessons()[0];
const timestamp = '2026-01-02T10:00:00.000Z';
const event = (value: Partial<ProgressEvent>): ProgressEvent => ({ type: 'explain-again', timestamp, conceptId: 'refraction', ...(value.type === 'quiz-answered' ? {} : { timelineStepId: 'step-refraction' }), ...value } as ProgressEvent);
const check = (quizId = 'quiz-bent', correctness = false) => event({ type: 'quiz-answered', quizId, correctness });
const observed = (events: ProgressEvent[]) => ({ ...emptyProgress(lesson), exportedAt: timestamp, events });
const refraction = (events: ProgressEvent[]) => lessonInsights(lesson, [observed(events)]).concepts.find(item => item.concept.id === 'refraction')!;

describe('concept-level teacher observations', () => {
  it('keeps 18 seeded learners distinct from received activity, without diagnosing ordinary pauses', () => {
    const seeded = seededRecords();
    expect(seeded.every(record => record.simulated)).toBe(true);
    const result = lessonInsights(lesson, seeded);
    expect(result.records).toHaveLength(18);
    expect(result.concepts.map(item => item.learnersWithSignals)).toEqual([0, 4]);
    expect(result.concepts.map(item => item.pauses)).toEqual([6, 12]);
    expect(result.concepts[1].variants.filter(item => item.views).map(item => [item.views, item.checks, item.correct])).toEqual([[6, 6, 4], [6, 6, 4]]);
    expect(lessonInsights(lesson, [observed([event({})])]).records).toHaveLength(1);
    expect(lessonInsights(lesson, seeded).records).toHaveLength(18);
  });
  it('counts distinct learners, requests, incorrect checks and retries per check without double-counting pauses', () => {
    const result = refraction([event({ type: 'pause' }), event({}), event({}), check(), check('quiz-bent', true)]);
    expect(result.learnersWithSignals).toBe(1);
    expect(result.explanationRequests).toBe(2);
    expect(result.incorrectChecks).toBe(1);
    expect(result.retries).toBe(1);
    expect(result.pauses).toBe(1);
    expect(refraction([event({ type: 'pause' })]).learnersWithSignals).toBe(0);
  });
  it('uses only the latest snapshot per learner and deduplicates retried event IDs without mutating records', () => {
    const old = observed([event({ eventId: 'event-old' })]);
    const newest = { ...observed([check()]), exportedAt: '2026-01-03T10:00:00.000Z' };
    newest.events[0].eventId = 'event-new'; newest.events.push(structuredClone(newest.events[0]));
    const original = structuredClone(newest);
    const result = lessonInsights(lesson, [newest, old, newest]);
    expect(result.records).toHaveLength(1);
    expect(result.concepts[1].incorrectChecks).toBe(1);
    expect(result.concepts[1].explanationRequests).toBe(0);
    expect(result.concepts[1].retries).toBe(0);
    expect(newest).toEqual(original);
  });
  it('filters other lessons and invalid concept, step, variant or check associations', () => {
    expect(lessonInsights(lesson, [{ ...observed([event({})]), lessonId: 'other-lesson' }]).records).toHaveLength(0);
    const result = refraction([event({ conceptId: 'other-concept' }), event({ timelineStepId: 'step-light' }), check('unknown-check'), event({ type: 'variant-viewed', variantId: 'light-original' })]);
    expect(result.learnersWithSignals).toBe(0);
    expect(result.contributors).toHaveLength(0);
  });
  it('preserves exact questions and learner isolation, and stops counting answered questions as pending', () => {
    const a = observed([]), b = { ...emptyProgress(demoLessons()[1]), exportedAt: timestamp };
    a.queuedQuestions = [{ id: 'question-a', text: '  Why this boundary?\n', timelineStepId: 'step-refraction', askedAt: timestamp, answered: false }];
    b.queuedQuestions = [{ id: 'question-b', text: 'Where is the ray?', timelineStepId: 'step-light', askedAt: timestamp, answered: false }];
    let result = lessonInsights(lesson, [a, b]);
    expect(result.concepts.map(item => item.pendingQuestions)).toEqual([1, 1]);
    expect(result.concepts[1].contributors[0].record.studentId).toBe(a.studentId);
    expect(result.concepts[1].contributors[0].questions[0].text).toBe('  Why this boundary?\n');
    a.queuedQuestions[0] = { ...a.queuedQuestions[0], answered: true, answer: 'Reviewed demo answer', sourceRefs: ['notes-light'] };
    result = lessonInsights(lesson, [a, b]);
    expect(result.concepts.map(item => item.pendingQuestions)).toEqual([1, 0]);
  });
  it('attributes checks only to prior explicit explanation views, including tied timestamps in event order', () => {
    const viewed = (variantId: string) => event({ type: 'variant-viewed', variantId });
    const result = refraction([check(), viewed('refraction-short'), check(), viewed('refraction-stepwise'), check('quiz-bent', true), viewed('refraction-short')]);
    const short = result.variants.find(item => item.variant.id === 'refraction-short')!;
    const stepwise = result.variants.find(item => item.variant.id === 'refraction-stepwise')!;
    expect([short.viewers, short.views, short.checks, short.correct]).toEqual([1, 2, 1, 0]);
    expect([stepwise.viewers, stepwise.views, stepwise.checks, stepwise.correct]).toEqual([1, 1, 1, 1]);
    expect(result.incorrectChecks).toBe(2); // the check before either explanation remains a concept observation
  });
  it('aggregates repeated original timeline steps into one stable concept', () => {
    const repeated = structuredClone(lesson);
    repeated.timeline.push({ ...repeated.timeline[1], id: 'step-refraction-revisit' });
    const result = lessonInsights(repeated, [observed([event({}), event({ timelineStepId: 'step-refraction-revisit' })])]);
    expect(result.concepts).toHaveLength(2);
    expect(result.concepts[1].steps.map(step => step.id)).toEqual(['step-refraction', 'step-refraction-revisit']);
    expect(result.concepts[1].learnersWithSignals).toBe(1);
    expect(result.concepts[1].explanationRequests).toBe(2);
  });
  it('makes check results and recorded visual timestamps inspectable, without mastery claims', () => {
    const text = describeInsightEvent(event({ type: 'visual-explored', visualAssetId: 'refraction-steps', recordingId: 'recording-one', positionMs: 1234, sourceRefs: ['notes-light'] }), lesson);
    expect(text).toContain('recording recording-one at 1.2s');
    expect(text).toContain('step-refraction');
    expect(describeInsightEvent(check(), lesson)).toContain('incorrect');
  });
});
