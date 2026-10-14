import { decryptPayload, encryptPayload, profiles, validateProgressRecord, type LessonPackage, type ProgressRecord } from '@coteacher/shared';
const key = 'coteacher-teacher-progress-v1';
export async function saveTeacherProgress(storage: Pick<Storage, 'setItem'>, records: ProgressRecord[]) {
  if (records.length > profiles.length || new Set(records.map(record => record.studentId)).size !== records.length) throw new Error('Store one snapshot for each simulated learner.');
  const values = await Promise.all(records.map(async record => {
    const profile = profiles.find(profile => profile.id === record.studentId);
    if (!profile || !record.simulated || !validateProgressRecord(record).valid) throw new Error('Only validated simulated learner records are supported.');
    return encryptPayload(record, profile.pin);
  }));
  try { storage.setItem(key, JSON.stringify(values)); }
  catch { throw new Error('Received records could not be saved on this teacher device. Retry before closing.'); }
}
export async function readTeacherProgress(storage: Pick<Storage, 'getItem'>, lessonFor: (id: string) => Promise<LessonPackage>) {
  const saved = storage.getItem(key);
  if (!saved) return [];
  const values: unknown = JSON.parse(saved);
  if (!Array.isArray(values) || values.length > profiles.length) throw new Error('Saved teacher records are invalid.');
  const records: ProgressRecord[] = [];
  for (const envelope of values) {
    let record: ProgressRecord | undefined;
    for (const profile of profiles) {
      try {
        const value = await decryptPayload(envelope, profile.pin);
        const result = validateProgressRecord(value, await lessonFor(profile.id));
        if (result.valid && result.data.studentId === profile.id && result.data.simulated) { record = result.data; break; }
      } catch { /* Try the other simulated owner without disclosing content. */ }
    }
    if (!record || records.some(existing => existing.studentId === record!.studentId)) throw new Error('Saved records do not match the current lesson revision. Their encrypted files remain on this device.');
    records.push(record);
  }
  return records;
}
