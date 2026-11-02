/* Generated from schemas/server-envelope.schema.json. Do not edit; run npm run generate:types. */

export interface ServerEnvelope {
  algorithm: "aes-256-gcm-server-v1";
  iv: string;
  tag: string;
  ciphertext: string;
}
