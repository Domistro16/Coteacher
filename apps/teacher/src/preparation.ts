import { localLessonGenerator, requirePublishedLesson, validateLessonPackage, type LessonPackage } from '@coteacher/shared';

export const preparationKey = 'coteacher-teacher-preparation-v1';
export interface Preparation { notes: string; activity: string; drafts: LessonPackage[] }
export const emptyPreparation = (): Preparation => ({ notes: '', activity: '', drafts: [] });

export function validatePreparation(value: unknown): Preparation {
  const state = value as Preparation;
  if (!state || typeof state.notes !== 'string' || typeof state.activity !== 'string' || !Array.isArray(state.drafts)
    || state.notes.length > 50000 || state.activity.length > 50000) throw new Error('Saved teacher preparation is invalid. Reload the demo materials to prepare it again.');
  if (state.drafts.length) {
    // This demo only assembles the supplied manual content. Recreate it from the
    // stored sources so changes cannot silently retain a previous approval.
    const expected = localLessonGenerator.generate(state.notes, state.activity);
    if (state.drafts.length !== expected.length) throw new Error('Saved personal packages are incomplete.');
    state.drafts.forEach((draft, index) => {
      if (!validateLessonPackage(draft).valid) throw new Error('Saved draft failed content and source-reference checks.');
      const { classroomTimeline, ...content } = draft;
      if (JSON.stringify({ ...content, publication: { status: 'draft' } }) !== JSON.stringify(expected[index])) {
        throw new Error('Saved content differs from the supplied sources. Prepare and review it again.');
      }
      if (JSON.stringify(draft.publication) !== JSON.stringify(state.drafts[0].publication)) throw new Error('Personal package approvals do not agree.');
      if (JSON.stringify(classroomTimeline) !== JSON.stringify(state.drafts[0].classroomTimeline)) throw new Error('Personal packages must share the same classroom timeline.');
      if (draft.publication.status === 'approved') {
        requirePublishedLesson(draft);
        if (draft.publication.approvalKind !== 'teacher-review') throw new Error('Teacher drafts require explicit teacher review.');
      }
    });
  }
  return state;
}

export function readPreparation(storage: Pick<Storage, 'getItem'>): Preparation {
  const saved = storage.getItem(preparationKey);
  return saved === null ? emptyPreparation() : validatePreparation(JSON.parse(saved));
}

export function savePreparation(storage: Pick<Storage, 'setItem'>, preparation: Preparation): void {
  validatePreparation(preparation);
  try { storage.setItem(preparationKey, JSON.stringify(preparation)); }
  catch { throw new Error('Teacher preparation could not be saved on this device. Free storage or allow browser storage, then retry.'); }
}
