import { audioBase64, recordingAudioBytes, type LessonRecording } from '@coteacher/shared';

export interface StoredMedia { iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }
export type LocalAudio = Extract<LessonRecording['audio'], { mediaId: string }>;
const cache = new WeakMap<LessonRecording['audio'], Promise<{ audio: LocalAudio; media: StoredMedia }>>();
async function keyFor(value: string) {
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
export async function remoteLocalReference(audio: Extract<LessonRecording['audio'], { mediaUrl: string }>): Promise<LocalAudio> {
  const fingerprint = await digest(Uint8Array.from(atob(audio.mediaKey), character => character.charCodeAt(0)));
  return { mimeType: audio.mimeType, sampleRate: audio.sampleRate, channels: 1, mediaKey: audio.mediaKey,
    mediaId: 'audio-' + audio.sha256 + '-' + fingerprint.slice(0, 16), byteLength: audio.byteLength };
}
export function prepareLocalMedia(recording: LessonRecording) {
  const existing = cache.get(recording.audio); if (existing) return existing;
  const task = (async () => {
    const bytes = recordingAudioBytes(recording);
    const mediaKey = recording.audio.mediaKey ?? audioBase64(crypto.getRandomValues(new Uint8Array(32)));
    const fingerprint = await digest(Uint8Array.from(atob(mediaKey), character => character.charCodeAt(0)));
    const mediaId = 'audio-' + await digest(bytes) + '-' + fingerprint.slice(0, 16);
    const audio: LocalAudio = { mimeType: recording.audio.mimeType, sampleRate: recording.audio.sampleRate,
      channels: 1, mediaKey, mediaId, byteLength: bytes.length };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(mediaKey), bytes);
    return { audio, media: { iv, ciphertext } };
  })();
  cache.set(recording.audio, task); task.catch(() => cache.delete(recording.audio)); return task;
}
export async function resolveLocalMedia(audio: LocalAudio, media: StoredMedia | undefined): Promise<LessonRecording['audio']> {
  if (!media) throw new Error('Recorded audio is missing from this device. Recollect the same teacher package to restore offline playback; your saved progress remains protected.');
  try {
    const bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: media.iv }, await keyFor(audio.mediaKey), media.ciphertext));
    if (bytes.length !== audio.byteLength || !(audio.mediaId.startsWith('audio-' + await digest(bytes) + '-'))) throw new Error('Audio checksum mismatch');
    const inline = { mimeType: audio.mimeType, sampleRate: audio.sampleRate, channels: 1 as const,
      mediaKey: audio.mediaKey, dataBase64: audioBase64(bytes) } as LessonRecording['audio'];
    cache.set(inline, Promise.resolve({ audio, media })); return inline;
  } catch { throw new Error('Recorded audio is incomplete or damaged on this device. Recollect the same package to restore it; saved progress remains protected.'); }
}
