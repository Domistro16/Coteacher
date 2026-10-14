import { validateLessonPackage, type LessonPackage, type LessonRecording } from '@coteacher/shared';

function key(lesson: LessonPackage): string {
  if (lesson.publication.status !== 'approved') throw new Error('Approve the lesson before recording.');
  return `${lesson.lessonId}:${lesson.publication.approvedAt}`;
}
function checked(lesson: LessonPackage, recording: unknown): LessonRecording {
  const result = validateLessonPackage({ ...lesson, recording });
  if (!result.valid || !result.data.recording) throw new Error('Saved recording failed audio, revision or timeline checks.');
  return result.data.recording;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('coteacher-teacher-recordings', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recordings');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Recording storage is unavailable. Allow browser storage and retry.'));
  });
}
export async function readRecording(lesson: LessonPackage): Promise<LessonRecording | null> {
  const identity = key(lesson);
  const db = await database();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction('recordings').objectStore('recordings').get(identity);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }).finally(() => db.close());
  return value == null ? null : checked(lesson, value);
}
export async function saveRecording(lesson: LessonPackage, recording: LessonRecording | null): Promise<void> {
  const identity = key(lesson);
  if (recording) checked(lesson, recording);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    const store = tx.objectStore('recordings');
    if (recording) store.put(recording, identity); else store.delete(identity);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error('Recording could not be saved. Free device storage and retry; keep this tab open.'));
  }).finally(() => db.close());
}
