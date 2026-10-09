import { decryptPayload, encryptPayload, validateLessonPackage, validateProgressRecord, type LessonPackage, type ProgressRecord } from '@coteacher/shared';
import { createPlayerModel, selectedVariant, type PlayerState } from './player';
import Ajv2020 from 'ajv/dist/2020.js';
import playerSchema from '../../../schemas/player-state.schema.json' with { type: 'json' };

const validatePlayer = new Ajv2020({ strict: true }).compile(playerSchema);

export interface Snapshot { lesson: LessonPackage; progress: ProgressRecord; player: PlayerState }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('coteacher-sprint', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles');
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
  const lesson = validateLessonPackage(snapshot?.lesson);
  if (!lesson.valid || lesson.data.studentId !== id || !lesson.data.simulated || !validateProgressRecord(snapshot?.progress, lesson.data).valid) throw new Error('Saved profile is invalid. Collect a checked package again.');
  const model = createPlayerModel(lesson.data);
  const state = snapshot.player;
  if (!validatePlayer(state) || state.timelineIndex >= model.steps.length || !selectedVariant(model, state)) throw new Error('Saved lesson position is invalid.');
  if (state.activity) {
    const variant = selectedVariant(model, state);
    if (variant.type !== 'tryit' || !['intro', 'steps', 'why'].includes(state.activity.phase) || !Number.isInteger(state.activity.instructionIndex) || state.activity.instructionIndex < 0 || state.activity.instructionIndex >= variant.steps.length) throw new Error('Saved activity is invalid.');
  }
  return snapshot;
}
export async function saveStoredProfile(id: string, pin: string, snapshot: Snapshot): Promise<void> {
  const payload = await encryptPayload(snapshot, pin);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('profiles', 'readwrite');
    tx.objectStore('profiles').put(payload, id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('Could not save. Device storage may be full.')); tx.onabort = () => reject(new Error('Save interrupted. Please retry.'));
  }).finally(() => db.close());
}
