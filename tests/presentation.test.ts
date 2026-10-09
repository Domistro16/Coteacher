import { describe, expect, it } from 'vitest';
import { approveLessons, demoLessons, localLessonGenerator, movePresentation, presentStep, reviewedMaterials, startPresentation, validateLessonPackage, type LessonPackage } from '@coteacher/shared';
import { emptyPreparation, readPreparation, savePreparation } from '../apps/teacher/src/preparation';
import { createPlayerModel, initialPlayerState, reducePlayerState, transitionPlayer } from '../apps/student/src/player';

const startedAt = '2026-10-09T12:00:00.000Z';
const later = '2026-10-09T12:01:00.000Z';
const start = (lesson = demoLessons()[0]) => startPresentation(lesson, 'step-light', startedAt, 'classroom-simulated-test');
function instruction(lesson: LessonPackage) { const { classroomTimeline, ...content } = lesson; return content; }

describe('manual classroom presentation', () => {
  it('requires approval and explicit start, and records the exact first displayed moment', () => {
    const draft = localLessonGenerator.generate(reviewedMaterials.teacherNotes, reviewedMaterials.activityNotes)[0];
    expect(() => start(draft)).toThrow('not been approved');
    expect(() => movePresentation(demoLessons()[0], 1)).toThrow('Start');
    expect(() => startPresentation(demoLessons()[0], 'missing')).toThrow('does not belong');
    const first = start();
    expect(first.classroomTimeline?.visits).toEqual([{ timelineStepId: 'step-light', conceptId: 'light-path', presentedAt: startedAt }]);
    const focused = startPresentation(demoLessons()[0], 'step-refraction', startedAt);
    expect(focused.classroomTimeline?.visits.map(visit => visit.conceptId)).toEqual(['refraction']);
  });
  it('records forward/backward revisits without changing approved instructional content', () => {
    const lesson = demoLessons()[0];
    const original = structuredClone(lesson);
    let active = start(lesson);
    active = movePresentation(active, 1, later);
    active = movePresentation(active, -1, '2026-10-09T12:02:00.000Z');
    active = presentStep(active, 'step-refraction', '2026-10-09T12:03:00.000Z');
    expect(active.classroomTimeline?.visits.map(visit => visit.timelineStepId)).toEqual(['step-light', 'step-refraction', 'step-light', 'step-refraction']);
    expect(active.classroomTimeline?.currentStepId).toBe('step-refraction');
    expect(instruction(active)).toEqual(original);
    expect(lesson).toEqual(original);
    expect(validateLessonPackage(active).valid).toBe(true);
  });
  it('handles boundaries, resuming and backward clock changes honestly', () => {
    const active = start();
    expect(movePresentation(active, -1)).toBe(active);
    expect(startPresentation(active)).toBe(active);
    expect(presentStep(active, 'step-light')).toBe(active);
    const last = movePresentation(active, 1, '2026-10-09T11:59:00.000Z');
    expect(last.classroomTimeline?.visits.at(-1)?.presentedAt).toBe(startedAt);
    expect(movePresentation(last, 1)).toBe(last);
    expect(() => presentStep(last, 'another-lesson-step')).toThrow('does not belong');
  });
  it('rejects dangling references, mismatched concepts, stale approvals and corrupt position/time', () => {
    const active = start();
    const invalid = [
      { ...active, publication: { status: 'draft' } },
      { ...active, classroomTimeline: { ...active.classroomTimeline, approvedAt: later } },
      { ...active, classroomTimeline: { ...active.classroomTimeline, currentStepId: 'step-refraction' } },
      { ...active, classroomTimeline: { ...active.classroomTimeline, visits: [{ timelineStepId: 'missing-step', conceptId: 'light-path', presentedAt: startedAt }] } },
      { ...active, classroomTimeline: { ...active.classroomTimeline, visits: [{ timelineStepId: 'step-light', conceptId: 'refraction', presentedAt: startedAt }] } },
      { ...active, classroomTimeline: { ...active.classroomTimeline, visits: [{ timelineStepId: 'step-light', conceptId: 'light-path', presentedAt: 'invalid-date' }] } },
      { ...active, classroomTimeline: { ...active.classroomTimeline, visits: [] } },
    ];
    for (const value of invalid) expect(validateLessonPackage(value).valid).toBe(false);
    const reverse = movePresentation(active, 1, later);
    reverse.classroomTimeline!.visits[1].presentedAt = '2026-10-09T11:59:00.000Z';
    expect(validateLessonPackage(reverse).valid).toBe(false);
  });
  it('persists position and identical classroom references for both learner routes; reapproval clears the record', () => {
    const state = { ...emptyPreparation(), notes: reviewedMaterials.teacherNotes, activity: reviewedMaterials.activityNotes,
      drafts: approveLessons(localLessonGenerator.generate(reviewedMaterials.teacherNotes, reviewedMaterials.activityNotes), true, '2026-10-09T11:00:00.000Z') };
    const presented = movePresentation(start(state.drafts[0]), 1, later);
    state.drafts = state.drafts.map(lesson => ({ ...lesson, classroomTimeline: presented.classroomTimeline }));
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    savePreparation(storage, state);
    const restored = readPreparation(storage);
    expect(restored.drafts[0].classroomTimeline).toEqual(restored.drafts[1].classroomTimeline);
    expect(restored.drafts[0].classroomTimeline?.currentStepId).toBe('step-refraction');
    expect(restored.drafts[0].route).not.toEqual(restored.drafts[1].route);
    expect(approveLessons(restored.drafts, true, later).every(lesson => !lesson.classroomTimeline)).toBe(true);
    const mismatch = structuredClone(state);
    delete mismatch.drafts[1].classroomTimeline;
    expect(() => savePreparation(storage, mismatch)).toThrow('same classroom timeline');
  });
});

describe('exact classroom moment in the offline learner', () => {
  it('opens the teacher default at the exact step on either personalized route and records its IDs', () => {
    for (const lesson of demoLessons()) {
      const model = createPlayerModel(lesson);
      const result = transitionPlayer(model, initialPlayerState(model), { type: 'revisit-step', timelineStepId: 'step-refraction' }, later);
      expect(model.steps[result.player.timelineIndex].step.id).toBe('step-refraction');
      expect(result.player.variantId).toBe('refraction-original');
      expect(result.events).toEqual([{ type: 'variant-viewed', timestamp: later, conceptId: 'refraction', timelineStepId: 'step-refraction', variantId: 'refraction-original' }]);
      expect(result.player.activity).toBeNull();
    }
  });
  it('distinguishes multiple moments of one concept and ignores missing targets', () => {
    const lesson = demoLessons()[1];
    lesson.timeline.push({ ...lesson.timeline[1], id: 'step-refraction-repeat', teacherSaid: 'Return to the same water-air boundary explanation.' });
    const model = createPlayerModel(lesson);
    const initial = initialPlayerState(model);
    const repeat = reducePlayerState(model, initial, { type: 'revisit-step', timelineStepId: 'step-refraction-repeat' });
    expect(repeat.timelineIndex).toBe(2);
    expect(model.steps[repeat.timelineIndex].step.id).toBe('step-refraction-repeat');
    expect(repeat.variantId).toBe('refraction-original');
    expect(reducePlayerState(model, repeat, { type: 'revisit-step', timelineStepId: 'step-refraction' }).timelineIndex).toBe(1);
    expect(reducePlayerState(model, repeat, { type: 'revisit-step', timelineStepId: 'unknown' })).toBe(repeat);
  });
});
