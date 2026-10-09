import type { LessonPackage, TimelineStep } from './generated/lesson-package';
import { requirePublishedLesson } from './publication';

function visit(step: TimelineStep, presentedAt: string) {
  return { timelineStepId: step.id, conceptId: step.conceptId, presentedAt };
}

/** Presentation adds references only. Approved instructional content is immutable. */
export function startPresentation(lesson: LessonPackage, stepId = lesson.timeline[0].id, startedAt = new Date().toISOString(), sessionId = 'classroom-' + crypto.randomUUID()): LessonPackage {
  requirePublishedLesson(lesson);
  if (lesson.classroomTimeline) return lesson;
  const first = lesson.timeline.find(step => step.id === stepId);
  if (!first) throw new Error('This classroom moment does not belong to the lesson.');
  return requirePublishedLesson({ ...lesson, classroomTimeline: {
    sessionId, approvedAt: lesson.publication.status === 'approved' ? lesson.publication.approvedAt : '',
    startedAt, currentStepId: first.id, visits: [visit(first, startedAt)],
  } });
}

export function presentStep(lesson: LessonPackage, stepId: string, timestamp = new Date().toISOString()): LessonPackage {
  requirePublishedLesson(lesson);
  const classroom = lesson.classroomTimeline;
  if (!classroom) throw new Error('Start the approved lesson presentation first.');
  const step = lesson.timeline.find(entry => entry.id === stepId);
  if (!step) throw new Error('This classroom moment does not belong to the lesson.');
  if (classroom.currentStepId === step.id) return lesson;
  // Preserve order if the device clock moves backwards during the session.
  const presentedAt = new Date(Math.max(Date.parse(timestamp), Date.parse(classroom.visits.at(-1)!.presentedAt))).toISOString();
  return requirePublishedLesson({ ...lesson, classroomTimeline: { ...classroom,
    currentStepId: step.id, visits: [...classroom.visits, visit(step, presentedAt)],
  } });
}

export function movePresentation(lesson: LessonPackage, direction: -1 | 1, timestamp = new Date().toISOString()): LessonPackage {
  requirePublishedLesson(lesson);
  if (!lesson.classroomTimeline) throw new Error('Start the approved lesson presentation first.');
  const index = lesson.timeline.findIndex(step => step.id === lesson.classroomTimeline!.currentStepId);
  const target = lesson.timeline[index + direction];
  return target ? presentStep(lesson, target.id, timestamp) : lesson;
}
