import { decryptPayload, encryptPayload, requirePublishedLesson, validateLessonPackage, validateProgressRecord, type LessonPackage, type ProgressRecord } from '@coteacher/shared';
import { createPlayerModel, selectedVariant, type PlayerState } from './player';
import Ajv2020 from 'ajv/dist/2020.js';
import playerSchema from '../../../schemas/player-state.schema.json' with { type: 'json' };
import { prepareLocalMedia, resolveLocalMedia, type StoredMedia } from './media-storage';

const validatePlayer = new Ajv2020({ strict: true }).compile(playerSchema);

export interface Snapshot { lesson: LessonPackage; progress: ProgressRecord; player: PlayerState }
export class MissingMediaError extends Error {
  constructor(message: string, public readonly snapshot: Snapshot) { super(message); }
}
const verifiedMedia = new WeakSet<object>();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('coteacher-sprint', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('profiles')) request.result.createObjectStore('profiles');
      if (!request.result.objectStoreNames.contains('media')) request.result.createObjectStore('media');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Device storage is unavailable. Your work cannot be saved.'));
  });
}
export async function readStoredProfile(id: string, pin: string): Promise<Snapshot | null> {
  const db = await database();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction('profiles').objectStore('profiles').get(id);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }).finally(() => db.close());
  if (!value) return null;
  const snapshot = await decryptPayload(value, pin) as Snapshot;
  const recording = snapshot?.lesson?.recording;
  const lesson = validateLessonPackage(snapshot?.lesson);
  if (!lesson.valid || lesson.data.studentId !== id || !lesson.data.simulated || !validateProgressRecord(snapshot?.progress, lesson.data).valid) throw new Error('Saved profile is invalid. Collect a checked package again.');
  requirePublishedLesson(lesson.data);
  const model = createPlayerModel(lesson.data);
  const state = snapshot.player;
  if (!validatePlayer(state) || state.timelineIndex >= model.steps.length || !selectedVariant(model, state)) throw new Error('Saved lesson position is invalid.');
  if (state.recording && (!recording || state.recording.recordingId !== recording.id || state.recording.positionMs > recording.durationMs)) throw new Error('Saved audio position does not belong to this recording.');
  if (recording && 'mediaId' in recording.audio) {
    const mediaDb = await database();
    const media = await new Promise<StoredMedia | undefined>((resolve, reject) => {
      const request = mediaDb.transaction('media').objectStore('media').get(recording.audio && 'mediaId' in recording.audio ? recording.audio.mediaId : '');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    }).finally(() => mediaDb.close());
    try { recording.audio = await resolveLocalMedia(recording.audio, media); }
    catch (error) { throw new MissingMediaError((error as Error).message, snapshot); }
    if (!validateLessonPackage(snapshot.lesson).valid) throw new MissingMediaError('Saved audio failed completeness checks. Recollect the same package.', snapshot);
  }
  if (state.activity) {
    const variant = selectedVariant(model, state);
    if (variant.type !== 'tryit' || !['intro', 'steps', 'why'].includes(state.activity.phase) || !Number.isInteger(state.activity.instructionIndex) || state.activity.instructionIndex < 0 || state.activity.instructionIndex >= variant.steps.length) throw new Error('Saved activity is invalid.');
  }
  return snapshot;
}
export async function saveStoredProfile(id: string, pin: string, snapshot: Snapshot): Promise<void> {
  requirePublishedLesson(snapshot.lesson);
  const local = snapshot.lesson.recording ? await prepareLocalMedia(snapshot.lesson.recording) : null;
  let repair = false;
  if (local && !verifiedMedia.has(local)) {
    const checkDb = await database();
    const existing = await new Promise<StoredMedia | undefined>((resolve, reject) => {
      const request = checkDb.transaction('media').objectStore('media').get(local.audio.mediaId);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    }).finally(() => checkDb.close());
    if (existing) { try { await resolveLocalMedia(local.audio, existing); } catch { repair = true; } }
  }
  const metadata = local ? { ...snapshot, lesson: { ...snapshot.lesson, recording: { ...snapshot.lesson.recording!, audio: local.audio } } } : snapshot;
  const payload = await encryptPayload(metadata, pin);
  const db = await database();
  // An imported complete package repairs missing/damaged media without duplicating it.
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(local ? ['profiles', 'media'] : ['profiles'], 'readwrite');
    tx.objectStore('profiles').put(payload, id);
    if (local) {
      const store = tx.objectStore('media');
      const request = store.get(local.audio.mediaId);
      request.onsuccess = () => {
        try { if (!request.result || repair) store.put(local.media, local.audio.mediaId); }
        catch { tx.abort(); }
      };
    }
    tx.oncomplete = () => { if (local) verifiedMedia.add(local); resolve(); };
    tx.onerror = () => reject(new Error('Could not save. Device storage may be full.'));
    tx.onabort = () => reject(new Error('Complete lesson media could not be saved. Device storage may be full. Please retry before leaving.'));
  }).finally(() => db.close());
}
