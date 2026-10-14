import type { LessonPackage, ProgressRecord, TryItVariant } from '@coteacher/shared';

function owned(lesson: LessonPackage, progress: ProgressRecord) {
  if (lesson.studentId !== progress.studentId || lesson.lessonId !== progress.lessonId) throw new Error('Progress belongs to a different learner or lesson.');
}

/** A reported activity is separate from responses to the concept's prepared check. */
export function activityCheckProgress(lesson: LessonPackage, progress: ProgressRecord, variant: TryItVariant) {
  owned(lesson, progress);
  const step = lesson.timeline.find(entry => entry.id === variant.returnToStep);
  if (!step || !lesson.concepts.find(entry => entry.id === step.conceptId)?.variants.some(entry => entry.id === variant.id && entry.type === 'tryit')) throw new Error('Activity does not belong to this concept.');
  const completion = [...progress.events].reverse().find(event => event.type === 'tryit-completed' && event.variantId === variant.id);
  const completionIndex = completion ? progress.events.indexOf(completion) : -1;
  const checks = lesson.quiz.filter(item => item.conceptId === step.conceptId);
  const attempts = completionIndex < 0 ? [] : progress.events.slice(completionIndex + 1).filter(event =>
    event.type === 'quiz-answered' && event.conceptId === step.conceptId && checks.some(item => item.id === event.quizId));
  return { reported: completionIndex >= 0, checks, attempts, latest: attempts.at(-1), step };
}

/** Retain each answer/retry rather than replacing a learner's previous result. */
export function answerUnderstandingCheck(lesson: LessonPackage, progress: ProgressRecord, quizId: string, selectedIndex: number, timestamp: string): ProgressRecord {
  owned(lesson, progress);
  const item = lesson.quiz.find(entry => entry.id === quizId);
  if (!item || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= item.options.length) throw new Error('Choose an available prepared answer.');
  return { ...progress, events: [...progress.events, { type: 'quiz-answered', timestamp, conceptId: item.conceptId,
    quizId, selectedIndex, correctness: selectedIndex === item.correctIndex, sourceRefs: [...item.sourceRefs] }] };
}
