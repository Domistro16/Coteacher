import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decryptPayload, encryptPayload, mergeReturnedAnswers, sameQuestionIdentity, sameProgressEvent, profiles, progressDigest, validateProgressRecord, type EncryptedTransfer, type LessonPackage, type ProgressReceipt, type ProgressRecord } from '@coteacher/shared';
import type { LessonDeliveryStore } from './store';

/** Bounded simulated school return, using the existing published recording. */
export class ProgressReturnStore {
  private lessonCache = new Map<string, { envelope: unknown; lesson: LessonPackage }>();
  constructor(private folder: string, private lessons: LessonDeliveryStore) {}
  async lesson(studentId: string, recordingId?: string): Promise<LessonPackage> {
    const profile = profiles.find(profile => profile.id === studentId);
    const envelope = this.lessons.packageFor(studentId);
    if (!profile || !envelope) throw new Error('Publish this simulated learner’s recorded lesson before synchronization.');
    let cached = this.lessonCache.get(studentId);
    if (!cached || cached.envelope !== envelope) { cached = { envelope, lesson: await decryptPayload(envelope, profile.pin) as LessonPackage }; this.lessonCache.set(studentId, cached); }
    const lesson = cached.lesson;
    if (!lesson.recording || recordingId && lesson.recording.id !== recordingId) throw new Error('The recorded revision changed. Your local progress is preserved; use school transfer for that revision.');
    return structuredClone(lesson);
  }
  private async read(studentId: string, lesson: LessonPackage) {
    let encrypted: EncryptedTransfer;
    try { encrypted = JSON.parse(await readFile(join(this.folder, `progress-${studentId}.json`), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    const value = await decryptPayload(encrypted, profiles.find(profile => profile.id === studentId)!.pin) as { recordingId: string; progress: ProgressRecord };
    if (value.recordingId !== lesson.recording!.id) return null;
    if (!validateProgressRecord(value.progress, lesson).valid || !value.progress.simulated) throw new Error('Saved school progress failed validation.');
    return value.progress;
  }
  private async write(studentId: string, lesson: LessonPackage, progress: ProgressRecord) {
    await mkdir(this.folder, { recursive: true });
    const bytes = JSON.stringify(await encryptPayload({ recordingId: lesson.recording!.id, progress }, profiles.find(profile => profile.id === studentId)!.pin));
    const temporary = join(this.folder, `progress-${randomBytes(8).toString('hex')}.tmp`);
    await writeFile(temporary, bytes); await rename(temporary, join(this.folder, `progress-${studentId}.json`));
  }
  async receive(studentId: string, recordingId: string, envelope: unknown): Promise<ProgressReceipt> {
    const lesson = await this.lesson(studentId, recordingId);
    const incoming = await decryptPayload(envelope, profiles.find(profile => profile.id === studentId)!.pin);
    const valid = validateProgressRecord(incoming, lesson);
    if (!valid.valid || !valid.data.simulated) throw new Error('Learning records do not belong to this learner, lesson and recording.');
    const previous = await this.read(studentId, lesson);
    // Never replace a longer history with an old device snapshot. Idempotent
    // retries are accepted, but divergent shared tabs need manual reconciliation.
    if (previous && (valid.data.events.length < previous.events.length || previous.events.some((event, index) => !sameProgressEvent(event, valid.data.events[index]))
      || previous.queuedQuestions.some(question => !valid.data.queuedQuestions.some(item => sameQuestionIdentity(item, question))))) throw new Error('The school has newer or different learning records. Nothing was overwritten. Use Sync & Transfers.');
    // Answers are authored on the teacher route; student submissions cannot
    // invent an answered queued question or edit a reviewed answer.
    if (valid.data.queuedQuestions.some(question => question.answered && !previous?.queuedQuestions.some(saved => saved.answered && JSON.stringify(saved) === JSON.stringify(question)))) throw new Error('Return teacher answers before synchronizing answered questions.');
    // This is a received snapshot, not a rewrite of any learner event timestamp.
    // Tutor and normal progress uploads may arrive in either order. Preserve a
    // monotonic snapshot time so teacher refreshes cannot hide appended events.
    const merged = { ...(previous ? mergeReturnedAnswers(valid.data, previous, lesson) : valid.data),
      exportedAt: new Date(Math.max(Date.now(), Date.parse(valid.data.exportedAt), previous ? Date.parse(previous.exportedAt) : 0)).toISOString() };
    await this.write(studentId, lesson, merged);
    return { schemaVersion: '1.0.0', studentId, lessonId: lesson.lessonId, recordingId, sha256: await progressDigest(valid.data), acceptedAt: new Date().toISOString(), simulated: true };
  }
  async returned(studentId: string, recordingId: string) {
    const lesson = await this.lesson(studentId, recordingId), record = await this.read(studentId, lesson);
    return record ? encryptPayload(record, profiles.find(profile => profile.id === studentId)!.pin) : null;
  }
  /** Internal validated read, avoiding an encrypt/decrypt HTTP envelope round trip. */
  async received(studentId: string, recordingId: string) {
    return this.read(studentId, await this.lesson(studentId, recordingId));
  }
  async overview() {
    const records: ProgressRecord[] = [];
    for (const profile of profiles) {
      if (!this.lessons.packageFor(profile.id)) continue;
      const lesson = await this.lesson(profile.id), value = await this.read(profile.id, lesson);
      if (value) records.push(value);
    }
    return records;
  }
  async answer(studentId: string, envelope: unknown) {
    const lesson = await this.lesson(studentId), previous = await this.read(studentId, lesson);
    if (!previous) throw new Error('Receive learning records before returning answers.');
    const value = await decryptPayload(envelope, profiles.find(profile => profile.id === studentId)!.pin);
    if (!validateProgressRecord(value, lesson).valid) throw new Error('Returned answers failed source and learner validation.');
    const returned = value as ProgressRecord;
    if (returned.queuedQuestions.some(question => question.answered && !previous.queuedQuestions.some(saved => sameQuestionIdentity(saved, question)))) {
      throw new Error('Answer context does not match a received question. Nothing was changed.');
    }
    const merged = mergeReturnedAnswers(previous, returned, lesson);
    await this.write(studentId, lesson, merged);
    return { saved: true, studentId };
  }
}
