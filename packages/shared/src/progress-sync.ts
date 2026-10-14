import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../schemas/progress-receipt.schema.json' with { type: 'json' };
import type { ProgressReceipt } from './generated/progress-receipt';
import syncSchema from '../../../schemas/progress-sync-state.schema.json' with { type: 'json' };
import type { ProgressSyncState } from './generated/progress-sync-state';
import type { ProgressRecord, Event } from './generated/progress-record';
import { validateProgressRecord } from './validation';
import { sameQuestionIdentity } from './sprint';
import type { LessonPackage } from './generated/lesson-package';
export type { ProgressReceipt };
export type { ProgressSyncState };
const validate = new Ajv2020({ strict: true }).compile(schema);
const validateSync = new Ajv2020({ strict: true }).compile<ProgressSyncState>(syncSchema);
export function validateProgressReceipt(value: unknown): value is ProgressReceipt { return Boolean(validate(value)); }
export async function progressDigest(value: unknown) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))));
  return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Assign once at the learner controller boundary, before saving or transmission. */
export function identifyProgressEvents(progress: ProgressRecord, id = () => 'event-' + crypto.randomUUID()): ProgressRecord {
  if (progress.events.every(event => event.eventId)) return progress;
  return { ...progress, events: progress.events.map(event => event.eventId ? event : { ...event, eventId: id() }) };
}

/** Legacy ledgers may acquire IDs once; an existing ID cannot change or disappear. */
export function sameProgressEvent(previous: Event, incoming: Event) {
  if (previous.eventId && previous.eventId !== incoming.eventId) return false;
  const { eventId: first, ...a } = previous, { eventId: second, ...b } = incoming;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function validateProgressSyncState(value: unknown, lesson: LessonPackage, progress: ProgressRecord): value is ProgressSyncState {
  if (!validateSync(value)) return false;
  const state = value;
  return validateProgressReceipt(state.receipt) && state.receipt.studentId === lesson.studentId
    && state.receipt.lessonId === lesson.lessonId && state.receipt.recordingId === lesson.recording?.id
    && state.eventIds.every((id, index) => progress.events[index]?.eventId === id)
    && state.questionIds.every(id => progress.queuedQuestions.some(question => question.id === id));
}

export function pendingProgress(progress: ProgressRecord, sync?: ProgressSyncState) {
  const received = new Set(sync?.eventIds), questions = new Set(sync?.questionIds);
  return { events: progress.events.filter(event => !event.eventId || !received.has(event.eventId)).length,
    questions: progress.queuedQuestions.filter(question => !questions.has(question.id)).length };
}

/** Recover an acknowledged school prefix without dropping unsent device work. */
export function recoverReceivedProgress(local: ProgressRecord, received: unknown, lesson: LessonPackage): ProgressRecord {
  if (!validateProgressRecord(local, lesson).valid || !validateProgressRecord(received, lesson).valid) throw new Error('Learning history recovery failed validation. Nothing was replaced.');
  const school = received as ProgressRecord;
  if (local.studentId !== school.studentId || local.lessonId !== school.lessonId || local.simulated !== school.simulated) throw new Error('Learning history belongs to a different learner or lesson.');
  const events = [...school.events];
  for (const event of local.events) {
    const existing = event.eventId ? events.find(item => item.eventId === event.eventId) : events.find(item => sameProgressEvent(event, item));
    if (existing) {
      if (!sameProgressEvent(event, existing)) throw new Error('An existing learning event was changed. Nothing was replaced.');
    } else events.push(event);
  }
  const queuedQuestions = [...school.queuedQuestions];
  for (const question of local.queuedQuestions) {
    const existing = queuedQuestions.find(item => item.id === question.id);
    if (existing) {
      if (!sameQuestionIdentity(question, existing)) throw new Error('An existing question was changed. Nothing was replaced.');
      if (question.answered && JSON.stringify(question) !== JSON.stringify(existing)) throw new Error('Reviewed guidance differs. Nothing was replaced.');
    } else {
      if (question.answered) throw new Error('The school has not acknowledged this reviewed answer. Nothing was replaced.');
      queuedQuestions.push(question);
    }
  }
  const merged = { ...local, events, queuedQuestions };
  if (!validateProgressRecord(merged, lesson).valid) throw new Error('Combined learning history failed validation. Nothing was replaced.');
  return merged;
}
