import { decryptPayload, encryptPayload, recordingCueAt, requirePublishedLesson, validateLessonPackage, validateProgressRecord, validateProgressSyncState, validTutorState, type TutorState, type ProgressSyncState, type LessonPackage, type ProgressRecord } from '@coteacher/shared';
import { createPlayerModel, selectedVariant, type PlayerState } from './player';
import Ajv2020 from 'ajv/dist/2020.js';
import playerSchema from '../../../schemas/player-state.schema.json' with { type: 'json' };
import { prepareLocalMedia, resolveLocalMedia, remoteLocalReference, type StoredMedia } from './media-storage';

const validatePlayer = new Ajv2020({ strict: true }).compile(playerSchema);

export interface Snapshot { lesson: LessonPackage; progress: ProgressRecord; player: PlayerState; sync?: ProgressSyncState; tutor?: TutorState }
export class MissingMediaError extends Error {
  constructor(message: string, public readonly snapshot: Snapshot) { super(message); }
}
const verifiedMedia = new WeakSet<object>();
/** Check ownership before either reading into a session or writing its database row. */
function checkedSnapshot(id: string, value: unknown): Snapshot {
  const snapshot = value as Snapshot;
  const lesson = validateLessonPackage(snapshot?.lesson);
  if (!lesson.valid || lesson.data.studentId !== id || !lesson.data.simulated || !validateProgressRecord(snapshot?.progress, lesson.data).valid) throw new Error('Saved profile is invalid. Collect a checked package again.');
  requirePublishedLesson(lesson.data);
  if (snapshot.tutor && !validTutorState(snapshot.tutor, lesson.data, snapshot.progress)) throw new Error('Saved tutor context belongs to a different learner or recording.');
  if (snapshot.sync && !validateProgressSyncState(snapshot.sync, lesson.data, snapshot.progress)) throw new Error('Saved synchronization belongs to a different learner, lesson or event history.');
  const model = createPlayerModel(lesson.data);
  const state = snapshot.player;
  if (!validatePlayer(state) || state.timelineIndex >= model.steps.length || !selectedVariant(model, state)) throw new Error('Saved lesson position is invalid.');
  const recording = lesson.data.recording;
  if (state.recording && (!recording || state.recording.recordingId !== recording.id || state.recording.positionMs > recording.durationMs)) throw new Error('Saved audio position does not belong to this recording.');
  if (state.recording?.support) {
    const support = state.recording.support;
    const cue = recordingCueAt(recording!, state.recording.positionMs);
    const asset = lesson.data.visualAssets?.find(entry => entry.id === support.visualAssetId);
    if (support.timelineStepId !== cue.timelineStepId || asset?.conceptId !== cue.conceptId) throw new Error('Saved visual support does not belong to this recorded moment.');
  }
  if (state.activity) {
    const variant = selectedVariant(model, state);
    if (variant.type !== 'tryit' || state.activity.instructionIndex >= variant.steps.length) throw new Error('Saved activity is invalid.');
  }
  return snapshot;
}
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
  const snapshot = checkedSnapshot(id, await decryptPayload(value, pin));
  const recording = snapshot?.lesson?.recording;
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
  return snapshot;
}
export async function saveStoredProfile(id: string, pin: string, snapshot: Snapshot): Promise<void> {
  checkedSnapshot(id, snapshot);
  const local = snapshot.lesson.recording && !('mediaUrl' in snapshot.lesson.recording.audio) ? await prepareLocalMedia(snapshot.lesson.recording) : null;
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

/** Reuse already verified shared audio when the other learner downloads this recording. */
export async function readDownloadedAudio(recording: NonNullable<LessonPackage['recording']>) {
  if (!('mediaUrl' in recording.audio)) return null;
  const audio = await remoteLocalReference(recording.audio);
  const db = await database();
  const media = await new Promise<StoredMedia | undefined>((resolve, reject) => {
    const request = db.transaction('media').objectStore('media').get(audio.mediaId);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }).finally(() => db.close());
  if (!media) return null;
  try { return await resolveLocalMedia(audio, media); } catch { return null; }
}
