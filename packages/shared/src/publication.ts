import type { LessonPackage } from './generated/lesson-package';
import { validateLessonPackage } from './validation';
import { hasReviewedDemoInstruction } from './reviewed-instruction';

/** Structural/source-ID validation is not verification of factual accuracy. */
export function requirePublishedLesson(value: unknown): LessonPackage {
  const result = validateLessonPackage(value);
  if (!result.valid) throw new Error('Lesson failed content and source-reference checks.');
  if (result.data.publication.status !== 'approved') throw new Error('This lesson has not been approved by the teacher.');
  if (result.data.recording && result.data.recording.review.status !== 'approved') throw new Error('Review and approve the classroom recording before publishing it.');
  if (result.data.playback && result.data.recording?.visualReview?.status !== 'approved') throw new Error('Review and approve both personalized visual sequences before publishing recorded playback.');
  if (result.data.playback && result.data.timeline.some(step => !result.data.recording!.cues.some(cue => cue.timelineStepId === step.id))) throw new Error('Record every lesson concept before publishing complete personalized playback.');
  if (result.data.recording?.audio.mimeType === 'audio/ogg;codecs=opus' && !result.data.playback) throw new Error('A compressed recorded lesson requires its reviewed personalized visual sequence.');
  if (result.data.publication.approvalKind === 'seeded-demo' && !result.data.simulated) {
    throw new Error('Seeded demo approval is only available for simulated lessons.');
  }
  if (!hasReviewedDemoInstruction(result.data)) throw new Error('This demo package differs from the reviewed teaching materials. Ask your teacher for a newly prepared and approved package.');
  return result.data;
}

export function approveLessons(drafts: LessonPackage[], reviewed: boolean, approvedAt = new Date().toISOString()): LessonPackage[] {
  if (!reviewed) throw new Error('Review the sources and instructional content before approving.');
  if (!drafts.length) throw new Error('Prepare a lesson before approving.');
  // Source content and objectives stay identical; derived replay has separate review.
  const instruction = (lesson: LessonPackage) => {
    const { studentId, route, publication, classroomTimeline, recording, playback, visualAssets, ...content } = lesson;
    return JSON.stringify(content);
  };
  if (drafts.some(lesson => instruction(lesson) !== instruction(drafts[0]))) {
    throw new Error('Personal packages must preserve identical content and learning objectives.');
  }
  return drafts.map(lesson => {
    const { classroomTimeline, recording, playback, visualAssets, ...content } = lesson;
    return requirePublishedLesson({ ...content, publication: { status: 'approved', approvedAt, approvalKind: 'teacher-review' } });
  });
}
