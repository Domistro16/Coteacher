import { describe, expect, it } from 'vitest';
import { emptyProgress, identifyProgressEvents, initialTutorState, observedMemory, validTutorState, validateProgressRecord } from '@coteacher/shared';
import { tutorPackages } from './tutor-fixture';
import { exploreRecordedVisual } from '../apps/student/src/recorded-help';
import { createPlayerModel, initialPlayerState } from '../apps/student/src/player';

describe('observed adaptive memory and visual provenance', () => {
  it('keeps automatic help as an observation without inventing a learner preference', () => {
    const [lesson] = tutorPackages(), player = initialPlayerState(createPlayerModel(lesson));
    const shown = exploreRecordedVisual(lesson, player, emptyProgress(lesson), 1300, 'refraction-pencil', '2026-10-14T09:00:00Z', 'prepared-help');
    const progress = identifyProgressEvents(shown.progress), state = initialTutorState(lesson);
    state.memory = observedMemory(lesson, progress, state.memory);
    expect(state.memory.observations).toHaveLength(1);
    expect(state.memory.recommendations).toEqual([]);
    expect(validateProgressRecord(progress, lesson).valid).toBe(true);
    expect(validTutorState(state, lesson, progress)).toBe(true);
  });
  it('uses incorrect checks for A and an explicit approved choice for B with separate evidence', () => {
    const [a, b] = tutorPackages(), pa = emptyProgress(a), pb = emptyProgress(b);
    pa.events.push({ type: 'quiz-answered', eventId: 'wrong-a', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', quizId: a.quiz.find(q => q.conceptId === 'refraction')!.id, correctness: false });
    pb.events.push({ type: 'visual-explored', origin: 'learner-choice', eventId: 'chosen-b', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction', recordingId: b.recording!.id, positionMs: 1300, visualAssetId: 'refraction-steps', sourceRefs: ['notes-light'] });
    const ma = observedMemory(a, pa, initialTutorState(a).memory), mb = observedMemory(b, pb, initialTutorState(b).memory);
    expect(ma.recommendations[0]).toMatchObject({ visualAssetId: 'refraction-pencil', evidenceEventIds: ['wrong-a'] });
    expect(mb.recommendations[0]).toMatchObject({ visualAssetId: 'refraction-steps', evidenceEventIds: ['chosen-b'] });
    expect(observedMemory(a, pa, ma)).toEqual(ma);
    expect(a.objective).toEqual(b.objective);
  });
  it('does not let automatically shown help hide a new incorrect attempt, but respects a later explicit choice', () => {
    const [lesson] = tutorPackages(), progress = emptyProgress(lesson);
    progress.events.push({ type: 'visual-explored', origin: 'prepared-help', eventId: 'automatic', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction', recordingId: lesson.recording!.id, positionMs: 1300, visualAssetId: 'refraction-steps', sourceRefs: ['notes-light'] });
    progress.events.push({ type: 'quiz-answered', eventId: 'wrong', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', quizId: lesson.quiz.find(q => q.conceptId === 'refraction')!.id, correctness: false });
    const state = initialTutorState(lesson); state.memory = observedMemory(lesson, progress, state.memory);
    expect(state.memory.recommendations[0]!.evidenceEventIds).toEqual(['wrong']);
    const automatic = progress.events[0];
    if (automatic.type !== 'visual-explored') throw new Error('Expected automatic visual event');
    progress.events.push({ ...automatic, origin: 'learner-choice', eventId: 'intentional' });
    state.memory = observedMemory(lesson, progress, state.memory);
    expect(state.memory.recommendations[0]).toMatchObject({ visualAssetId: 'refraction-steps', evidenceEventIds: ['intentional'] });
    const forged = structuredClone(state); forged.memory.observations[0].detail = 'A made-up diagnosis';
    expect(validTutorState(forged, lesson, progress)).toBe(false);
  });
  it('keeps legacy exploration valid without calling it an explicit selection', () => {
    const [lesson] = tutorPackages(), progress = emptyProgress(lesson);
    progress.events.push({ type: 'visual-explored', eventId: 'legacy', timestamp: '2026-10-14T09:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction', recordingId: lesson.recording!.id, positionMs: 1300, visualAssetId: 'refraction-steps', sourceRefs: ['notes-light'] });
    const memory = observedMemory(lesson, progress, initialTutorState(lesson).memory);
    expect(memory.recommendations[0]!.reason).toContain('explored');
    expect(memory.recommendations[0]!.reason).not.toContain('selected');
    expect(validateProgressRecord(progress, lesson).valid).toBe(true);
  });
});
