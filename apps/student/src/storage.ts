import { decryptPayload, encryptPayload, recordingCueAt, requirePublishedLesson, validateLessonPackage, validateProgressRecord, validateProgressSyncState, validTutorState, type TutorState, type ProgressSyncState, type LessonPackage, type ProgressRecord } from '@coteacher/shared';
import { createPlayerModel, selectedVariant, type PlayerState } from './player';
import Ajv2020 from 'ajv/dist/2020.js';
import playerSchema from '../../../schemas/player-state.schema.json' with { type: 'json' };
import { prepareLocalMedia, resolveLocalMedia, remoteLocalReference, type StoredMedia } from './media-storage';
import { checkedKnowledge, emptyPrivateMemory,validPrivateMemory, type PrivateLearnerMemory } from '../../../packages/shared/src/learning-engine';
import { checkPreparedSupport, type PreparedSupport } from '../../../packages/shared/src/preparation';
import learningReferenceSchema from '../../../schemas/learning-reference.schema.json' with {type:'json'};
import type { LearningReference } from '../../../packages/shared/src/generated/learning-reference';

const validatePlayer = new Ajv2020({ strict: true }).compile(playerSchema);
const validLearningReference=new Ajv2020({strict:true}).compile<LearningReference>(learningReferenceSchema);

export interface Snapshot { lesson: LessonPackage; progress: ProgressRecord; player: PlayerState; sync?: ProgressSyncState; tutor?: TutorState; learning?: {memory:PrivateLearnerMemory;support:PreparedSupport|null} }
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
  if(snapshot.learning){
    if(!validPrivateMemory(snapshot.learning.memory) || snapshot.learning.memory.learnerId!==id)throw new Error('Private learning memory belongs to another learner.');
    if(snapshot.learning.support){checkPreparedSupport(snapshot.learning.support,lesson.data);checkedKnowledge(snapshot.learning.support.knowledge,lesson.data);if(snapshot.learning.support.status!=='approved')throw new Error('Offline support needs teacher review.');}
  }
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
    const request = indexedDB.open('coteacher-sprint', 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('profiles')) request.result.createObjectStore('profiles');
      if (!request.result.objectStoreNames.contains('media')) request.result.createObjectStore('media');
      if (!request.result.objectStoreNames.contains('learning')) request.result.createObjectStore('learning');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Device storage is unavailable. Your work cannot be saved.'));
  });
}
export async function readStoredProfile(id: string, pin: string, storageKey = id): Promise<Snapshot | null> {
  if(storageKey!==id&&!storageKey.startsWith(id+':'))throw new Error('Storage key belongs to another learner.');
  const db = await database();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction('profiles').objectStore('profiles').get(storageKey);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }).finally(() => db.close());
  if (!value) return null;
  const raw=await decryptPayload(value,pin) as Omit<Snapshot,'learning'> & {learning?:{memory?:PrivateLearnerMemory;memoryRef?:LearningReference;support:PreparedSupport|null}};
  if(raw?.learning){
    // New snapshots reference one private encrypted row; they never duplicate preferences/evidence.
    if(!validLearningReference(raw.learning.memoryRef) || raw.learning.memoryRef.learnerId!==id || Object.keys(raw.learning).some(k=>!['memoryRef','support'].includes(k)))throw new Error('Saved private memory reference belongs to another learner or version.');
    const memory=await readPrivateLearning(id,pin)??emptyPrivateMemory(id);
    const snapshot=checkedSnapshot(id,{...raw,learning:{support:raw.learning.support,memory}});
    return resolveSnapshotMedia(snapshot);
  }
  const snapshot = checkedSnapshot(id,raw);
  return resolveSnapshotMedia(snapshot);
}
async function resolveSnapshotMedia(snapshot:Snapshot):Promise<Snapshot>{
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
export async function saveStoredProfile(id: string, pin: string, snapshot: Snapshot, storageKey = id): Promise<void> {
  if(storageKey!==id&&!storageKey.startsWith(id+':'))throw new Error('Storage key belongs to another learner.');
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
  const metadata = {...snapshot,...(local?{lesson: { ...snapshot.lesson, recording: { ...snapshot.lesson.recording!, audio: local.audio } }}:{}),
    ...(snapshot.learning?{learning:{support:snapshot.learning.support,memoryRef:{schemaVersion:'1.0.0',learnerId:id}}}:{})};
  const payload = await encryptPayload(metadata, pin);
  const learningPayload=snapshot.learning?await encryptPayload(snapshot.learning.memory,pin):undefined;
  const db = await database();
  // An imported complete package repairs missing/damaged media without duplicating it.
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...['profiles'],...(local?['media']:[]),...(learningPayload?['learning']:[])], 'readwrite');
    tx.objectStore('profiles').put(payload, storageKey);
    if(learningPayload)tx.objectStore('learning').put(learningPayload,id);
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
export async function readPrivateLearning(id:string,pin:string):Promise<PrivateLearnerMemory|null>{
  const db=await database();
  const value=await new Promise<unknown>((resolve,reject)=>{const r=db.transaction('learning').objectStore('learning').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}).finally(()=>db.close());
  if(!value)return null;
  const memory=await decryptPayload(value,pin).catch(()=>{throw new Error('Use the same device PIN for this learner’s lessons to keep private learning memory together.');});
  if(!validPrivateMemory(memory) || memory.learnerId!==id)throw new Error('Private learning memory belongs to another learner.');return memory;
}
/** Deletes optional encrypted memory without needing a PIN. Instruction/progress/media rows are retained. */
export async function clearPrivateLearning(ids:readonly string[]):Promise<void>{
  if(ids.some(id=>!/^student-[a-f0-9]{8,32}$/.test(id)))throw new Error('Invalid learner memory owner.');
  if(!ids.length)return;
  const db=await database();
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('learning','readwrite');for(const id of ids)tx.objectStore('learning').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('Private memory could not be removed from this device.'));tx.onabort=()=>reject(new Error('Private memory deletion did not finish.'));}).finally(()=>db.close());
  if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('coteacher-learning-privacy');channel.postMessage({clearedLearners:[...ids]});channel.close();}
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
