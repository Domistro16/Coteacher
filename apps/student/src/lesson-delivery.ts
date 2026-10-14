import { audioBase64, decryptPayload, requirePublishedLesson, type LessonPackage, type LessonRecording } from '@coteacher/shared';
import { readDownloadedAudio } from './storage';

export type DownloadProgress = { received: number; total: number; phase: 'downloading' | 'checking' | 'saving' | 'complete' };
export async function openPublishedRecording(studentId: string, pin: string): Promise<LessonPackage> {
  let response: Response;
  try { response = await fetch(`/api/lessons/${studentId}`, { cache: 'no-store' }); }
  catch { throw new Error('The lesson service is unavailable. Connect to the configured lesson service or import your teacher’s complete recorded package.'); }
  if (!response.ok) {
    const value = await response.json().catch(() => null);
    throw new Error(value?.error ?? 'No teacher recording is available. Ask your teacher to record, review and publish the lesson.');
  }
  const lesson = requirePublishedLesson(await decryptPayload(await response.json(), pin));
  if (lesson.studentId !== studentId || !lesson.simulated || !lesson.recording || !lesson.playback || !('mediaUrl' in lesson.recording.audio)) throw new Error('The published recorded lesson does not belong to this profile.');
  return lesson;
}

/** Full-byte acquisition and verification are separate from opening the streaming player. */
export async function downloadRecordedLesson(lesson: LessonPackage, onProgress: (value: DownloadProgress) => void): Promise<LessonPackage> {
  requirePublishedLesson(lesson);
  const recording = lesson.recording;
  if (!recording || !('mediaUrl' in recording.audio)) throw new Error('Open a published recording before downloading it.');
  const audio = recording.audio;
  onProgress({ received: 0, total: audio.byteLength, phase: 'downloading' });
  const cached = await readDownloadedAudio(recording);
  let inline: LessonRecording['audio'];
  if (cached) inline = cached;
  else {
    const response = await fetch(audio.mediaUrl, { cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error('The teacher audio could not be downloaded. Keep the streaming lesson and retry while connected.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        received += value.byteLength;
        if (received > audio.byteLength) throw new Error('The downloaded recording exceeds its expected size.');
        chunks.push(value); onProgress({ received, total: audio.byteLength, phase: 'downloading' });
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    if (received !== audio.byteLength) throw new Error('The recording download is incomplete. Retry before going offline.');
    onProgress({ received, total: audio.byteLength, phase: 'checking' });
    const bytes = new Uint8Array(received); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (sha256 !== audio.sha256) throw new Error('Downloaded audio failed its checksum. Reconnect and download it again.');
    inline = { mimeType: audio.mimeType, sampleRate: audio.sampleRate, channels: 1, mediaKey: audio.mediaKey, dataBase64: audioBase64(bytes) } as LessonRecording['audio'];
  }
  const complete = requirePublishedLesson({ ...lesson, recording: { ...recording, audio: inline } });
  onProgress({ received: audio.byteLength, total: audio.byteLength, phase: 'saving' });
  return complete;
}
