import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../schemas/encrypted-transfer.schema.json' with { type: 'json' };
import type { EncryptedTransfer } from './generated/encrypted-transfer';

export type { EncryptedTransfer };
const validate = new Ajv2020({ strict: true }).compile(schema);
const bytes = (value: string) => {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) output[i] = binary.charCodeAt(i);
  return output;
};
const base64 = (value: Uint8Array) => {
  let text = '';
  for (let i = 0; i < value.length; i += 8192) text += String.fromCharCode(...value.subarray(i, i + 8192));
  return btoa(text);
};
export function validateEncryptedTransfer(value: unknown): value is EncryptedTransfer {
  return Boolean(validate(value));
}
export function validatePin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) throw new Error('Use a six-digit PIN.');
}
async function derive(pin: string, salt: Uint8Array<ArrayBuffer>) {
  validatePin(pin);
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptPayload(value: unknown, pin: string): Promise<EncryptedTransfer> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await derive(pin, salt),
    new TextEncoder().encode(JSON.stringify(value)));
  return { schemaVersion: '1.0.0', algorithm: 'PBKDF2-SHA256/AES-256-GCM', iterations: 210000,
    salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext)) };
}
export async function decryptPayload(value: unknown, pin: string): Promise<unknown> {
  if (!validateEncryptedTransfer(value)) throw new Error('This encrypted file is invalid or too large.');
  validatePin(pin);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(value.iv) },
      await derive(pin, bytes(value.salt)), bytes(value.ciphertext));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch { throw new Error('Cannot unlock this file. Check the PIN; the file may be damaged.'); }
}
export function downloadFile(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readTransferFile(file: File): Promise<unknown> {
  if (file.size > 48_000_000) throw new Error('File is too large. Maximum size is 48 MB.');
  try { return JSON.parse(await file.text()); }
  catch { throw new Error('Choose a valid Coteacher JSON file.'); }
}
