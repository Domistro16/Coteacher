import { describe, expect, it } from 'vitest';
import { approveLessons, demoLessons, localLessonGenerator, requirePublishedLesson, reviewedMaterials, validateLessonPackage } from '@coteacher/shared';
import { emptyPreparation, preparationKey, readPreparation, savePreparation, validatePreparation, type Preparation } from '../apps/teacher/src/preparation';

const prepared = (): Preparation => ({ notes: reviewedMaterials.teacherNotes, activity: reviewedMaterials.activityNotes,
  drafts: localLessonGenerator.generate(reviewedMaterials.teacherNotes, reviewedMaterials.activityNotes) });
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

describe('source-grounded preparation and publication', () => {
  it('starts new generation as a draft, separately from approved seeded collection', () => {
    for (const draft of prepared().drafts) {
      expect(validateLessonPackage(draft).valid).toBe(true);
      expect(draft.publication).toEqual({ status: 'draft' });
      expect(() => requirePublishedLesson(draft)).toThrow('not been approved');
    }
    for (const seed of demoLessons()) {
      expect(requirePublishedLesson(seed).publication).toMatchObject({ status: 'approved', approvalKind: 'seeded-demo' });
    }
  });
  it('requires human acknowledgement, keeps both learner objectives, and does not mutate drafts', () => {
    const drafts = prepared().drafts;
    expect(() => approveLessons(drafts, false)).toThrow('Review');
    const approved = approveLessons(drafts, true, '2026-10-09T10:00:00.000Z');
    expect(approved[0].objective).toEqual(approved[1].objective);
    expect(approved[0].route).not.toEqual(approved[1].route);
    expect(drafts[0].publication.status).toBe('draft');
    for (const lesson of approved) expect(requirePublishedLesson(lesson).publication).toEqual({ status: 'approved', approvedAt: '2026-10-09T10:00:00.000Z', approvalKind: 'teacher-review' });
    const divergent = structuredClone(drafts);
    divergent[1].objective.text = 'A different objective';
    expect(() => approveLessons(divergent, true)).toThrow('identical');
    expect(() => approveLessons([], true)).toThrow('Prepare');
  });
  it('rejects missing, malformed and source-less approval packages', () => {
    const approved = approveLessons(prepared().drafts, true)[0];
    const { publication, ...legacy } = approved;
    for (const value of [legacy, { ...approved, publication: { status: 'approved' } },
      { ...approved, publication: { ...publication, approvedAt: 'yesterday' } },
      { ...approved, concepts: [{ ...approved.concepts[0], sourceRefs: ['invented-source'] }, approved.concepts[1]] }]) {
      expect(() => requirePublishedLesson(value)).toThrow('checks');
    }
    expect(() => requirePublishedLesson({ ...demoLessons()[0], simulated: false })).toThrow('simulated');
  });
});

describe('teacher preparation persistence', () => {
  it('round trips sources, drafts and approval; regeneration discards approval', () => {
    const storage = memoryStorage();
    expect(readPreparation(storage)).toEqual(emptyPreparation());
    const state = prepared();
    savePreparation(storage, state);
    expect(readPreparation(storage)).toEqual(state);
    state.drafts = approveLessons(state.drafts, true);
    savePreparation(storage, state);
    expect(readPreparation(storage)).toEqual(state);
    savePreparation(storage, prepared());
    expect(readPreparation(storage).drafts.every(lesson => lesson.publication.status === 'draft')).toBe(true);
  });
  it('rejects corrupt state and approvals retained after changing content or sources', () => {
    const storage = memoryStorage();
    storage.setItem(preparationKey, '{broken');
    expect(() => readPreparation(storage)).toThrow();
    expect(() => validatePreparation({ notes: '', activity: '', drafts: {} })).toThrow('invalid');
    const approved = prepared(); approved.drafts = approveLessons(approved.drafts, true);
    expect(() => validatePreparation({ ...approved, notes: 'A different source' })).toThrow('supports only');
    const edited = structuredClone(approved); edited.drafts[0].concepts[0].variants[0].content = 'An unreviewed explanation';
    expect(() => savePreparation(storage, edited)).toThrow('differs');
    const partial = { ...approved, drafts: [approved.drafts[0]] };
    expect(() => validatePreparation(partial)).toThrow('incomplete');
    approved.drafts[1].publication = { status: 'draft' };
    expect(() => validatePreparation(approved)).toThrow('do not agree');
  });
  it('propagates storage failure so a failed save cannot enable publication', () => {
    const storage = { setItem: () => { throw new Error('quota'); } };
    const state = prepared(); state.drafts = approveLessons(state.drafts, true);
    expect(() => savePreparation(storage, state)).toThrow('could not be saved');
  });
});
