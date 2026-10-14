import { describe, expect, it } from 'vitest';
import { audioBase64, cueForStep, demoLessons, emptyProgress, encodeRecordingWav, identifyProgressEvents,
  mergeReturnedAnswers, pendingProgress, sameProgressEvent, recoverReceivedProgress, simulatedAnswerProvider, queuedDemoQuestion,
  validateProgressRecord, validateProgressSyncState, type ProgressSyncState, type LessonRecording } from '@coteacher/shared';
import receiptSchema from '../schemas/progress-receipt.schema.json';
import syncSchema from '../schemas/progress-sync-state.schema.json';
import { tutorPackages } from './tutor-fixture';

function fixture() {
  const lesson = demoLessons()[0];
  const recording: LessonRecording = { id: 'sync-recording', lessonId: lesson.lessonId, classroomSessionId: 'sync-class',
    lessonApprovedAt: lesson.publication.status === 'approved' ? lesson.publication.approvedAt : '', startedAt: '2026-10-09T10:00:00Z',
    durationMs: 2000, origin: 'teacher-microphone', audio: { mimeType: 'audio/wav', sampleRate: 16000, channels: 1,
      dataBase64: audioBase64(encodeRecordingWav([new Float32Array(32000).fill(.2)], 16000)) },
    cues: [cueForStep(lesson, 'step-light', 0), cueForStep(lesson, 'step-refraction', 1000)], review: { status: 'draft' } };
  lesson.recording = recording;
  const progress = emptyProgress(lesson);
  progress.events.push({ type: 'pause', timestamp: progress.exportedAt, conceptId: 'refraction', timelineStepId: 'step-refraction', eventId: 'event-1' });
  progress.queuedQuestions.push({ id: 'question-1', text: queuedDemoQuestion, askedAt: progress.exportedAt, timelineStepId: 'step-refraction', answered: false });
  const sync: ProgressSyncState = { receipt: { schemaVersion: '1.0.0', studentId: lesson.studentId, lessonId: lesson.lessonId,
    recordingId: recording.id, acceptedAt: '2026-10-09T11:00:00.000Z', sha256: 'a'.repeat(64), simulated: true },
    eventIds: ['event-1'], questionIds: ['question-1'] };
  return { lesson, progress, sync };
}

describe('durable received prefixes and stable event identity', () => {
  it('recovers school-only history and retains offline device work without duplicating stable IDs', () => {
    const { progress } = fixture(); const lesson = tutorPackages()[0];
    const school = structuredClone(progress);
    school.events.push({ ...school.events[0], eventId: 'school-only' });
    const local = structuredClone(progress);
    local.events.push({ ...local.events[0], eventId: 'offline-only' });
    local.queuedQuestions.push({ ...local.queuedQuestions[0], id: 'offline-question', text: 'A new offline question?' });
    const merged = recoverReceivedProgress(local, school, lesson);
    expect(merged.events.map(event => event.eventId)).toEqual(['event-1', 'school-only', 'offline-only']);
    expect(merged.queuedQuestions.map(question => question.id)).toEqual(['question-1', 'offline-question']);
    expect(recoverReceivedProgress(merged, school, lesson)).toEqual(merged);
    expect(local.events).toHaveLength(2); expect(school.events).toHaveLength(2);
  });
  it('refuses altered event IDs, question identity and foreign learner history without mutating either copy', () => {
    const { progress } = fixture(); const lesson = tutorPackages()[0];
    const changed = structuredClone(progress); changed.events[0].timestamp = '2026-10-10T00:00:00Z';
    expect(() => recoverReceivedProgress(progress, changed, lesson)).toThrow('event was changed');
    const question = structuredClone(progress); question.queuedQuestions[0].text = 'Changed question';
    expect(() => recoverReceivedProgress(progress, question, lesson)).toThrow('question was changed');
    const foreign = structuredClone(progress); foreign.studentId = 'student-b1c2d3e4';
    expect(() => recoverReceivedProgress(progress, foreign, lesson)).toThrow();
    expect(progress.events[0].timestamp).not.toBe(changed.events[0].timestamp);
  });
  it('imports returned teacher guidance but rejects unacknowledged local answers', () => {
    const { progress } = fixture(); const lesson = tutorPackages()[0];
    const received = structuredClone(progress);
    received.queuedQuestions = received.queuedQuestions.map(question => simulatedAnswerProvider.answer(question));
    expect(recoverReceivedProgress(progress, received, lesson).queuedQuestions[0].answered).toBe(true);
    expect(() => recoverReceivedProgress(received, progress, lesson)).toThrow('guidance differs');
  });
  it('keeps the nested receipt contract in agreement with the receiving service', () => {
    const { $id, $schema, title, ...receipt } = receiptSchema;
    expect(syncSchema.properties.receipt).toEqual(receipt);
  });
  it('assigns IDs once, preserves existing IDs, and does not mutate a legacy ledger', () => {
    const { progress } = fixture(); delete progress.events[0].eventId;
    let counter = 0;
    const identified = identifyProgressEvents(progress, () => 'event-' + ++counter);
    expect(progress.events[0].eventId).toBeUndefined(); expect(identified.events[0].eventId).toBe('event-1');
    expect(identifyProgressEvents(identified)).toBe(identified);
    identified.events.push({ ...identified.events[0], eventId: undefined });
    expect(identifyProgressEvents(identified, () => 'event-2').events.map(event => event.eventId)).toEqual(['event-1', 'event-2']);
  });
  it('allows legacy ID migration without permitting changes to established identity or event content', () => {
    const { progress } = fixture(), event = progress.events[0], legacy = { ...event }; delete legacy.eventId;
    expect(sameProgressEvent(legacy, event)).toBe(true);
    expect(sameProgressEvent(event, legacy)).toBe(false);
    expect(sameProgressEvent(event, { ...event, eventId: 'changed' })).toBe(false);
    expect(sameProgressEvent(event, { ...event, timestamp: '2026-10-09T12:00:00Z' })).toBe(false);
  });
  it('rejects duplicate event IDs but retains old progress records', () => {
    const { progress } = fixture(); progress.events.push({ ...progress.events[0] });
    expect(validateProgressRecord(progress).valid).toBe(false);
    progress.events.forEach(event => delete event.eventId);
    expect(validateProgressRecord(progress).valid).toBe(true);
  });
  it('acknowledges only submitted IDs and never removes pending question content', () => {
    const { lesson, progress, sync } = fixture();
    expect(validateProgressSyncState(sync, lesson, progress)).toBe(true);
    expect(pendingProgress(progress, sync)).toEqual({ events: 0, questions: 0 });
    progress.events.push({ ...progress.events[0], eventId: 'event-2' });
    progress.queuedQuestions.push({ ...progress.queuedQuestions[0], id: 'question-2', text: 'Unexpected new question?' });
    expect(pendingProgress(progress, sync)).toEqual({ events: 1, questions: 1 });
    expect(progress.queuedQuestions.every(question => !question.answered)).toBe(true);
    expect(validateProgressSyncState(sync, lesson, progress)).toBe(true);
  });
  it.each(['studentId', 'lessonId', 'recordingId'] as const)('rejects a checkpoint for another %s', field => {
    const { lesson, progress, sync } = fixture();
    sync.receipt[field] = field === 'studentId' ? 'student-b1c2d3e4' : 'another-revision';
    expect(validateProgressSyncState(sync, lesson, progress)).toBe(false);
  });
  it('rejects unknown or reordered received event IDs and unknown question IDs', () => {
    const { lesson, progress, sync } = fixture();
    for (const eventIds of [['not-sent'], ['event-1', 'event-1'], ['event-2', 'event-1']])
      expect(validateProgressSyncState({ ...sync, eventIds }, lesson, progress)).toBe(false);
    expect(validateProgressSyncState({ ...sync, questionIds: ['another-question'] }, lesson, progress)).toBe(false);
  });
  it('preserves newer local events and answered guidance when an older server snapshot arrives', () => {
    const { lesson, progress } = fixture(); delete lesson.recording;
    const returned = { ...progress, queuedQuestions: progress.queuedQuestions.map(question => simulatedAnswerProvider.answer(question)) };
    const local = mergeReturnedAnswers(progress, returned, lesson);
    local.events.push({ ...local.events[0], eventId: 'event-2' });
    const old = structuredClone(returned);
    if (old.queuedQuestions[0].answered) old.queuedQuestions[0].answer = 'Older returned guidance.';
    expect(mergeReturnedAnswers(local, old, lesson)).toEqual(local);
    expect(local.queuedQuestions[0]).toMatchObject({ answered: true, answerOrigin: 'simulated-prepared' });
  });
});
