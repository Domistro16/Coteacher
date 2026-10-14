import type { LessonPackage, LessonRecording } from './generated/lesson-package';
import { checkOpusContainer } from './opus-container';

export const recordingSampleRate = 16000;
/** Legacy PCM imports only. New streaming Opus capture has no two-minute stop. */
export const legacyWavLimitSeconds = 120;
export type RecordingCue = LessonRecording['cues'][number];

export function cueForStep(lesson: LessonPackage, timelineStepId: string, offsetMs: number): RecordingCue {
  const step = lesson.timeline.find(entry => entry.id === timelineStepId);
  if (!step) throw new Error('Unknown recorded lesson moment.');
  return { timelineStepId, conceptId: step.conceptId, sourceRefs: [...step.sourceRefs], offsetMs: Math.floor(offsetMs) };
}

/** Equal-time transitions (including paused navigation) resolve to the last visual. */
export function recordingCueAt(recording: LessonRecording, timeMs: number): RecordingCue {
  let low = 0, high = recording.cues.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (recording.cues[middle].offsetMs <= timeMs) low = middle + 1; else high = middle;
  }
  return recording.cues[Math.max(0, low - 1)];
}

/** Canonical mono PCM WAV: finite duration and seeking across browser containers. */
export function encodeRecordingWav(chunks: Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (!length || length / sampleRate > legacyWavLimitSeconds + .001) throw new Error('Legacy WAV supports up to two minutes; use streaming Opus for classroom recording.');
  const pcm = new Float32Array(length);
  let position = 0;
  for (const chunk of chunks) { pcm.set(chunk, position); position += chunk.length; }
  const outputLength = Math.floor(length * recordingSampleRate / sampleRate);
  const bytes = new Uint8Array(44 + outputLength * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, recordingSampleRate, true); view.setUint32(28, recordingSampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, outputLength * 2, true);
  // Average native-rate samples when downsampling, instead of discarding them.
  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * sampleRate / recordingSampleRate);
    const end = Math.min(length, Math.max(start + 1, Math.floor((i + 1) * sampleRate / recordingSampleRate)));
    let value = 0;
    for (let j = start; j < end; j++) value += pcm[j];
    value = Math.max(-1, Math.min(1, value / (end - start)));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

export function audioBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function recordingAudioBytes(recording: LessonRecording): Uint8Array<ArrayBuffer> {
  if (!('dataBase64' in recording.audio)) throw new Error('The complete recorded audio is missing from local storage. Recollect this package.');
  const binary = atob(recording.audio.dataBase64);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) output[i] = binary.charCodeAt(i);
  return output;
}

const audioChecks = new WeakMap<LessonRecording['audio'], { base64: string; mimeType: string; duration: number; valid: boolean }>();
/** Structural checks do not establish what the teacher said or verify sources. */
export function checkRecordingAudio(recording: LessonRecording): boolean {
  if (!('dataBase64' in recording.audio)) return true;
  const previous = audioChecks.get(recording.audio);
  if (previous?.base64 === recording.audio.dataBase64 && previous.mimeType === recording.audio.mimeType && previous.duration === recording.durationMs) return previous.valid;
  const valid = inspectRecordingAudio(recording);
  audioChecks.set(recording.audio, { base64: recording.audio.dataBase64, mimeType: recording.audio.mimeType, duration: recording.durationMs, valid });
  return valid;
}
function inspectRecordingAudio(recording: LessonRecording): boolean {
  try {
    // Local references are resolved and authenticated by the storage boundary before playback.
    if (!('dataBase64' in recording.audio)) return true;
    const bytes = recordingAudioBytes(recording);
    if (recording.audio.mimeType === 'audio/ogg;codecs=opus') return checkOpusContainer(bytes, recording.durationMs);
    if (bytes.length <= 44 || bytes.length > 3_840_044 || (bytes.length - 44) % 2) return false;
    const view = new DataView(bytes.buffer);
    const text = (offset: number, count: number) => String.fromCharCode(...bytes.subarray(offset, offset + count));
    if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE' || text(12, 4) !== 'fmt ' || text(36, 4) !== 'data'
      || view.getUint32(4, true) !== bytes.length - 8 || view.getUint32(16, true) !== 16
      || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1
      || view.getUint32(24, true) !== 16000 || view.getUint32(28, true) !== 32000
      || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16
      || view.getUint32(40, true) !== bytes.length - 44
      || recording.durationMs !== Math.floor((bytes.length - 44) / 32)) return false;
    let energy = 0;
    for (let i = 44; i < bytes.length; i += 2) energy += (view.getInt16(i, true) / 32768) ** 2;
    return Math.sqrt(energy / ((bytes.length - 44) / 2)) > .0001;
  } catch { return false; }
}

export function reviewRecording(recording: LessonRecording, acknowledged: boolean, reviewedAt = new Date().toISOString()): LessonRecording {
  if (!acknowledged) throw new Error('Review the audio, timing and sources, and confirm no student conversations are included.');
  return { ...recording, review: { status: 'approved', reviewedAt } };
}
