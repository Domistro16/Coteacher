import fixture from '../../../fixtures/demo-lesson/lesson-package.json' with { type: 'json' };
import materials from '../../../fixtures/demo-lesson/reviewed-materials.json' with { type: 'json' };
import narration from '../../../fixtures/demo-lesson/narration.json' with { type: 'json' };
import type { LessonPackage, QuizItem } from './generated/lesson-package';
import type { ProgressRecord, QueuedQuestion } from './generated/progress-record';
import { validateLessonPackage, validateProgressRecord } from './validation';

export const profiles = [
  { id: 'student-a1b2c3d4', label: 'Student A', pin: '111111', simulated: true },
  { id: 'student-b1c2d3e4', label: 'Student B', pin: '222222', simulated: true },
] as const;
export const reviewedMaterials = materials;
export interface LessonGenerator { generate(notes: string, activity: string): LessonPackage[] }
const normalize = (text: string) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
export const localLessonGenerator: LessonGenerator = {
  generate(notes, activity) {
    if (normalize(notes) !== normalize(materials.teacherNotes) || normalize(activity) !== normalize(materials.activityNotes)) {
      throw new Error('This simulation supports only the supplied, reviewed light/refraction notes and activity notes. Use the demo materials.');
    }
    return profiles.map((profile, index) => {
      const lesson = structuredClone(fixture) as LessonPackage;
      for (const concept of lesson.concepts) for (const variant of concept.variants) {
        const path = (narration.clips as Record<string, string>)[variant.content];
        if (path) variant.audioAssetPath = path;
      }
      lesson.studentId = profile.id;
      if (index === 1) {
        lesson.route.insertedRefreshers = [];
        const route = lesson.route.conceptRoutes[1];
        route.variantOrder = ['refraction-stepwise', 'refraction-original', 'refraction-short', 'refraction-analogy', 'refraction-tryit'];
        route.reason = 'Your simulated previous practice suggests trying the steps first. You can change explanations or return to your teacher at any time.';
      }
      const result = validateLessonPackage(lesson);
      if (!result.valid) throw new Error('The generated package did not pass source and contract checks.');
      return result.data;
    });
  },
};
export function demoLessons(): LessonPackage[] {
  return localLessonGenerator.generate(materials.teacherNotes, materials.activityNotes);
}
export function emptyProgress(lesson: LessonPackage): ProgressRecord {
  return { schemaVersion: '1.0.0', lessonId: lesson.lessonId, studentId: lesson.studentId,
    exportedAt: new Date().toISOString(), simulated: true, events: [], queuedQuestions: [] };
}
export function chooseQuiz(lesson: LessonPackage, progress: ProgressRecord): QuizItem[] {
  const confused = new Set(progress.events.filter(e => ['pause', 'explain-again', 'question-no-match'].includes(e.type)).map(e => e.conceptId));
  return lesson.quiz.filter(q => !confused.size || confused.has(q.conceptId));
}
export const queuedDemoQuestion = 'Should I use a glass cup for this activity?';
export interface QueuedAnswerProvider { answer(question: QueuedQuestion): QueuedQuestion }
export const simulatedAnswerProvider: QueuedAnswerProvider = {
  answer(question) {
    if (question.answered || normalize(question.text).toLowerCase().replace(/[?.!]+$/, '') !== queuedDemoQuestion.toLowerCase().replace('?', '')) return question;
    return { ...question, answered: true, answer: 'Use a clear plastic cup, never glass. Ask an adult to help, and keep the water away from electrical equipment.', sourceRefs: ['notes-activity'] };
  },
};
export function mergeReturnedAnswers(local: ProgressRecord, returned: ProgressRecord, lesson: LessonPackage): ProgressRecord {
  if (!validateProgressRecord(returned, lesson).valid) throw new Error('The returned progress does not belong to this lesson and profile.');
  return { ...local, queuedQuestions: local.queuedQuestions.map(q => {
    const updated = returned.queuedQuestions.find(item => item.id === q.id && item.text === q.text && item.timelineStepId === q.timelineStepId && item.askedAt === q.askedAt);
    return updated?.answered ? updated : q;
  }) };
}
export function seededRecords(): ProgressRecord[] {
  return Array.from({ length: 18 }, (_, i) => {
    const record = emptyProgress(demoLessons()[0]);
    record.studentId = 'student-' + (4096 + i).toString(16).padStart(8, '0');
    record.exportedAt = '2026-01-01T10:00:00.000Z';
    const step = i < 12 ? 'step-refraction' : 'step-light';
    const concept = i < 12 ? 'refraction' : 'light-path';
    record.events = [{ type: 'pause', timestamp: record.exportedAt, conceptId: concept, timelineStepId: step }];
    if (i < 12) record.events.push({ type: 'variant-viewed', timestamp: record.exportedAt, conceptId: concept, timelineStepId: step, variantId: i % 2 ? 'refraction-stepwise' : 'refraction-short' },
      { type: 'quiz-answered', timestamp: record.exportedAt, conceptId: concept, quizId: 'quiz-bent', correctness: i % 3 !== 0 });
    return record;
  });
}
export function upsertSnapshot(records: ProgressRecord[], incoming: ProgressRecord): ProgressRecord[] {
  const existing = records.find(r => r.lessonId === incoming.lessonId && r.studentId === incoming.studentId);
  if (existing && Date.parse(existing.exportedAt) >= Date.parse(incoming.exportedAt)) throw new Error('This snapshot was already imported or is older than the stored snapshot.');
  return [...records.filter(r => r.lessonId !== incoming.lessonId || r.studentId !== incoming.studentId), incoming];
}
export const simulatedHistory = { simulated: true, previousCohort: { refraction: 12, lightPath: 6 },
  nudge: 'Students struggled at the water boundary last time. Show the safe pencil demonstration here, then connect what they see to the change in light direction.', sourceRefs: ['notes-light', 'notes-activity'] };

export interface FutureFeature { available: false; description: string }
export const futureFeatures: Record<string, FutureFeature> = Object.fromEntries([
  ['AutomaticSpeechFollowing', 'Automatic following of teacher speech'], ['ExamPractice', 'Full exam practice'],
  ['LocalLanguageSpeech', 'On-device local-language speech models'], ['QueuedAnswerNotifications', 'Answer notifications'],
  ['SchoolOwnerView', 'School-owner view'], ['LocalNetworkTransfer', 'Hotspot / local-network transfer'],
].map(([name, description]) => [name, { available: false as const, description }]));
