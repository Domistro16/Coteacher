/* Generated from schemas/encrypted-transfer.schema.json. Do not edit; run npm run generate:types. */

export interface EncryptedTransfer {
  schemaVersion: "1.0.0";
  algorithm: "PBKDF2-SHA256/AES-256-GCM";
  iterations: 210000;
  salt: string;
  iv: string;
  ciphertext: string;
}
