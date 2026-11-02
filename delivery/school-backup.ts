import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv from "ajv/dist/2020.js";
import schema from "../schemas/school-backup.schema.json" with { type: "json" };
import type { SchoolBackup } from "../packages/shared/src/generated/school-backup";
import {
  checkSchoolState,
  restoreSchoolState,
  type SchoolRepository,
} from "./school-store";
import type { PrivateStorage } from "./private-storage";

const valid = new Ajv({ strict: true }).compile<SchoolBackup>(schema);
const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
function keyBytes(key: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error(
      "Supply a separate 32-byte backup key as 64 hexadecimal characters.",
    );
  return Buffer.from(key, "hex");
}
function encrypt(bytes: Uint8Array, key: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}
function decrypt(bytes: Uint8Array, key: string) {
  const value = Buffer.from(bytes);
  if (value.length < 29) throw new Error("Invalid backup envelope.");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(key),
    value.subarray(0, 12),
  );
  cipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]);
}
export async function backupSchool(
  repository: SchoolRepository,
  storage: PrivateStorage,
  folder: string,
  key: string,
) {
  keyBytes(key);
  const state = await repository.transaction((s) => structuredClone(s));
  checkSchoolState(state);
  const keys = [
    ...new Set([
      ...state.lessons.flatMap((l) => [l.templateKey, l.audioKey]),
      ...state.learningRecords.map((r) => r.objectKey),
      ...state.tutorRecords.map((r) => r.objectKey),
    ]),
  ];
  await mkdir(folder, { recursive: true });
  const manifest: SchoolBackup = {
    schemaVersion: "1.0.0",
    createdAt: new Date().toISOString(),
    stateJson: JSON.stringify(state),
    objects: [],
  };
  for (const objectKey of keys) {
    const bytes = await storage.get(objectKey);
    if (!bytes.length) throw new Error("Backup references an empty object.");
    manifest.objects.push({
      key: objectKey,
      sha256: sha(bytes),
      byteLength: bytes.length,
    });
    await writeFile(
      join(folder, sha(objectKey) + ".bin"),
      encrypt(bytes, key),
      { flag: "wx", mode: 0o600 },
    );
  }
  // A complete authenticated manifest is committed only after every object is written.
  await writeFile(
    join(folder, "manifest.bin"),
    encrypt(Buffer.from(JSON.stringify(manifest)), key),
    { flag: "wx", mode: 0o600 },
  );
  return { objects: manifest.objects.length, createdAt: manifest.createdAt };
}
export async function restoreSchool(
  repository: SchoolRepository,
  storage: PrivateStorage,
  folder: string,
  key: string,
) {
  const manifest: unknown = JSON.parse(
    decrypt(await readFile(join(folder, "manifest.bin")), key).toString(),
  );
  if (!valid(manifest)) throw new Error("Invalid backup manifest.");
  const state = restoreSchoolState(JSON.parse(manifest.stateJson));
  if (
    new Set(manifest.objects.map((o) => o.key)).size !== manifest.objects.length
  )
    throw new Error("Duplicate backup objects.");
  const required = new Set([
    ...state.lessons.flatMap((l) => [l.templateKey, l.audioKey]),
    ...state.learningRecords.map((r) => r.objectKey),
    ...state.tutorRecords.map((r) => r.objectKey),
  ]);
  if (
    required.size !== manifest.objects.length ||
    manifest.objects.some((o) => !required.has(o.key))
  )
    throw new Error("Backup objects do not match the recorded metadata.");
  await repository.transaction((s) => {
    if (s.accounts.length || s.schools.length)
      throw new Error("Restore requires an empty target database.");
  });
  for (const object of manifest.objects) {
    const bytes = decrypt(
      await readFile(join(folder, sha(object.key) + ".bin")),
      key,
    );
    if (sha(bytes) !== object.sha256 || bytes.length !== object.byteLength)
      throw new Error("Backup checksum mismatch.");
    await storage.put(
      object.key,
      bytes,
      object.key.endsWith(".ogg") ? "audio/ogg" : "application/json",
    );
  }
  state.loginSessions = [];
  state.uploads = [];
  state.retiredObjects = [];
  await repository.transaction((s) => {
    if (s.accounts.length || s.schools.length)
      throw new Error("Restore target changed.");
    Object.assign(s, state);
  });
  return {
    objects: manifest.objects.length,
    createdAt: manifest.createdAt,
    sessionsRevoked: true,
  };
}
