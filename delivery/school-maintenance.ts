import type { SchoolState } from "../packages/shared/src/generated/school-state";
import type { SchoolRepository } from "./school-store";
import type { PrivateStorage } from "./private-storage";

export function retireSchoolObject(
  state: SchoolState,
  key: string,
  now = Date.now(),
) {
  const deleteAfter = new Date(now + 24 * 3600_000).toISOString();
  const existing = state.retiredObjects.find((o) => o.key === key);
  if (existing) existing.deleteAfter = deleteAfter;
  else state.retiredObjects.push({ key, deleteAfter });
}
const references = (s: SchoolState) =>
  new Set([
    ...s.lessons.flatMap((l) => [l.templateKey, l.audioKey]),
    ...s.learningRecords.map((r) => r.objectKey),
    ...s.tutorRecords.map((r) => r.objectKey),
  ]);
/** Deletes only immutable superseded versions and expired/consumed upload objects. */
export async function maintainSchool(
  repository: SchoolRepository,
  storage: PrivateStorage,
  now = Date.now(),
) {
  const candidates = await repository.transaction((s) => {
    s.loginSessions = s.loginSessions.filter(
      (session) => Date.parse(session.expiresAt) > now,
    );
    const current = references(s);
    return [
      ...s.retiredObjects
        .filter((o) => Date.parse(o.deleteAfter) <= now && !current.has(o.key))
        .map((o) => o.key),
      ...s.uploads
        // A consumed application ticket does not revoke its signed PUT URL.
        // Retain the cleanup record until that URL expires, so a late PUT cannot
        // recreate an object after its only cleanup record has been removed.
        .filter(
          (u) =>
            (u.used && Date.parse(u.expiresAt) <= now) ||
            Date.parse(u.expiresAt) < now - 24 * 3600_000,
        )
        .map((u) => u.objectKey),
    ].slice(0, 1000);
  });
  const deleted = new Set<string>();
  for (let start = 0; start < candidates.length; start += 8) {
    const keys = candidates.slice(start, start + 8),
      results = await Promise.allSettled(
        keys.map((key) => storage.delete(key)),
      );
    results.forEach((result, index) => {
      if (result.status === "fulfilled") deleted.add(keys[index]);
    });
  }
  await repository.transaction((s) => {
    s.retiredObjects = s.retiredObjects.filter((o) => !deleted.has(o.key));
    s.uploads = s.uploads.filter((u) => !deleted.has(u.objectKey));
  });
  return {
    deletedObjects: deleted.size,
    pendingObjects: candidates.length - deleted.size,
  };
}
