import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import schema from "../schemas/server-envelope.schema.json" with { type: "json" };
import type { ServerEnvelope } from "../packages/shared/src/generated/server-envelope";
const valid = new Ajv({ strict: true }).compile<ServerEnvelope>(schema);
/** High-entropy server keys are intentionally separate from six-digit device-PIN transfers. */
export function sealServer(
  value: unknown,
  key: Uint8Array,
  context: string,
): ServerEnvelope {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const result: ServerEnvelope = {
    algorithm: "aes-256-gcm-server-v1",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
  if (!valid(result))
    throw new Error("Server-encrypted state exceeds its budget.");
  return result;
}
export function openServer(
  value: unknown,
  key: Uint8Array,
  context: string,
): unknown {
  if (!valid(value)) throw new Error("Invalid server encryption envelope.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
