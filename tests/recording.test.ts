import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { audioBase64, checkRecordingAudio, cueForStep, demoLessons, encodeRecordingWav, recordingCueAt, requirePublishedLesson,
  reviewRecording, startPresentation, validateLessonPackage, approveLessons, encryptPayload, decryptPayload, validateEncryptedTransfer, type LessonRecording } from '@coteacher/shared';

function fixture() {
  const lesson = startPresentation(demoLessons()[0], 'step-light', '2026-10-09T10:00:00.000Z', 'recorded-class');
  const pcm = Float32Array.from({ length: 32000 }, (_, i) => Math.sin(i * Math.PI / 20) * .25);
  const recording: LessonRecording = { id: 'test-recording', lessonId: lesson.lessonId, classroomSessionId: 'recorded-class',
    lessonApprovedAt: lesson.publication.status === 'approved' ? lesson.publication.approvedAt : '', startedAt: '2026-10-09T10:00:01.000Z',
    durationMs: 2000, origin: 'teacher-microphone', audio: { mimeType: 'audio/wav', sampleRate: 16000, channels: 1, dataBase64: audioBase64(encodeRecordingWav([pcm], 16000)) },
    cues: [cueForStep(lesson, 'step-light', 0), cueForStep(lesson, 'step-refraction', 1000)], review: { status: 'draft' } };
  return { lesson, recording };
}

describe('real audio and recorded visual contracts', () => {
  it('fits the full two-minute reviewed audio in a valid encrypted transfer under the import cap', async () => {
    const { lesson, recording } = fixture();
    const wav = encodeRecordingWav([new Float32Array(16000 * 120).fill(.2)], 16000);
    const full = reviewRecording({ ...recording, durationMs: 120000, audio: { ...recording.audio, dataBase64: audioBase64(wav) } }, true, '2026-10-09T10:05:00.000Z');
    const payload = requirePublishedLesson({ ...lesson, recording: full });
    const encrypted = await encryptPayload(payload, '111111');
    expect(validateEncryptedTransfer(encrypted)).toBe(true);
    expect(JSON.stringify(encrypted, null, 2).length).toBeLessThan(8_000_000);
    expect(requirePublishedLesson(await decryptPayload(encrypted, '111111')).recording?.durationMs).toBe(120000);
  }, 15000);
  it('encodes finite seekable mono WAV, resamples and rejects empty/silent/fake audio', () => {
    const { recording } = fixture();
    expect(checkRecordingAudio(recording)).toBe(true);
    const wav = encodeRecordingWav([new Float32Array(48000).fill(.2)], 48000);
    expect(wav.length).toBe(32044);
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(16000);
    expect(checkRecordingAudio({ ...recording, durationMs: 1000, audio: { ...recording.audio, dataBase64: audioBase64(wav) } })).toBe(true);
    expect(() => encodeRecordingWav([], 16000)).toThrow('two minutes');
    expect(() => encodeRecordingWav([new Float32Array(16000 * 121)], 16000)).toThrow('two minutes');
    expect(checkRecordingAudio({ ...recording, audio: { ...recording.audio, dataBase64: audioBase64(encodeRecordingWav([new Float32Array(32000)], 16000)) } })).toBe(false);
    expect(checkRecordingAudio({ ...recording, durationMs: 1000 })).toBe(false);
    expect(checkRecordingAudio({ ...recording, audio: { ...recording.audio, dataBase64: btoa('silent slideshow metadata only') } })).toBe(false);
  });
  it('rechecks the container when cached audio is relabelled as another supported format', () => {
    const { lesson, recording } = fixture();
    expect(validateLessonPackage({ ...lesson, recording }).valid).toBe(true);
    Object.assign(recording.audio, { mimeType: 'audio/ogg;codecs=opus', mediaKey: audioBase64(new Uint8Array(32)) });
    expect(checkRecordingAudio(recording)).toBe(false);
    expect(validateLessonPackage({ ...lesson, recording }).valid).toBe(false);
    Object.assign(recording.audio, { mimeType: 'audio/wav' });
    expect(checkRecordingAudio(recording)).toBe(true);
  });
  it('retains original source links, lesson revision and stable exact step IDs', () => {
    const { lesson, recording } = fixture();
    expect(validateLessonPackage({ ...lesson, recording }).valid).toBe(true);
    for (const changed of [
      { ...recording, lessonId: 'other' }, { ...recording, classroomSessionId: 'other' },
      { ...recording, lessonApprovedAt: '2025-01-01T00:00:00Z' },
      { ...recording, cues: [{ ...recording.cues[0], conceptId: 'refraction' }] },
      { ...recording, cues: [{ ...recording.cues[0], sourceRefs: ['notes-activity'] }] },
      { ...recording, cues: [{ ...recording.cues[0], offsetMs: 1 }] },
      { ...recording, cues: [recording.cues[0], { ...recording.cues[1], offsetMs: 2001 }] },
      { ...recording, cues: [...recording.cues, { ...recording.cues[0], offsetMs: 500 }] },
    ]) expect(validateLessonPackage({ ...lesson, recording: changed }).valid).toBe(false);
  });
  it('gates collection on independent recording review and clears media on reapproval', () => {
    const { lesson, recording } = fixture();
    expect(() => requirePublishedLesson({ ...lesson, recording })).toThrow('recording');
    expect(() => reviewRecording(recording, false)).toThrow('Review');
    const approved = reviewRecording(recording, true, '2026-10-09T10:00:05.000Z');
    expect(requirePublishedLesson({ ...lesson, recording: approved }).recording).toEqual(approved);
    expect(recording.review.status).toBe('draft');
    expect(approveLessons([{ ...lesson, recording: approved }], true)[0].recording).toBeUndefined();
    expect(validateLessonPackage({ ...lesson, recording: reviewRecording(recording, true, '2025-01-01T00:00:00Z') }).valid).toBe(false);
  });
  it('resolves seeks and equal-time paused transitions to the last displayed exact step', () => {
    const { lesson, recording } = fixture();
    recording.cues.push(cueForStep(lesson, 'step-light', 1000), cueForStep(lesson, 'step-refraction', 1500));
    expect(recordingCueAt(recording, 999).timelineStepId).toBe('step-light');
    expect(recordingCueAt(recording, 1000).timelineStepId).toBe('step-light');
    expect(recordingCueAt(recording, 1499).timelineStepId).toBe('step-light');
    expect(recordingCueAt(recording, 1500).timelineStepId).toBe('step-refraction');
    expect(recordingCueAt(recording, 0).timelineStepId).toBe('step-light');
  });
  it('resolves exact native audio seeks despite floating-point seconds, without anticipating real transitions', () => {
    const { lesson, recording } = fixture();
    for (const offset of [16060, 16080, 16220, 16240, 16380, 7234160]) {
      recording.cues = [cueForStep(lesson, 'step-light', 0), cueForStep(lesson, 'step-refraction', offset)];
      expect(recordingCueAt(recording, offset / 1000 * 1000).timelineStepId).toBe('step-refraction');
      expect(recordingCueAt(recording, offset - .0001).timelineStepId).toBe('step-light');
    }
  });
});

describe('actual worklet audio clock', () => {
  function worklet() {
    const messages: any[] = [];
    let Processor: any;
    runInNewContext(readFileSync('apps/teacher/audio-capture-worklet.js', 'utf8'), {
      AudioWorkletProcessor: class { port = { onmessage: null, postMessage: (data: unknown) => messages.push(data) }; },
      registerProcessor: (_name: string, value: any) => { Processor = value; }, sampleRate: 16000, Float32Array,
    });
    const processor = new Processor();
    const send = (data: unknown) => processor.port.onmessage({ data });
    const sample = (count: number) => processor.process([[new Float32Array(count).fill(.2)]]);
    return { processor, messages, send, sample };
  }
  it('counts captured samples only, retains paused transitions, resumes at the current visual and flushes before stop', () => {
    const { lesson } = fixture();
    const { messages, send, sample } = worklet();
    send({ type: 'start', cue: cueForStep(lesson, 'step-light', 0) }); sample(16000);
    send({ type: 'cue', cue: cueForStep(lesson, 'step-refraction', 0) }); sample(8000);
    send({ type: 'pause' }); sample(16000 * 10);
    send({ type: 'cue', cue: cueForStep(lesson, 'step-light', 0) });
    send({ type: 'resume', cue: cueForStep(lesson, 'step-light', 0) }); sample(8000); send({ type: 'stop' });
    expect(messages.filter(entry => entry.type === 'cue').map(entry => [entry.cue.timelineStepId, entry.cue.offsetMs]))
      .toEqual([['step-light', 0], ['step-refraction', 1000], ['step-light', 1500], ['step-light', 1500]]);
    const chunks = messages.filter(entry => entry.type === 'chunk').map(entry => entry.chunk);
    expect(chunks.reduce((count, chunk) => count + chunk.length, 0)).toBe(32000);
    expect(messages.at(-1)).toEqual({ type: 'stopped', offsetMs: 2000 });
    expect(encodeRecordingWav(chunks, 16000).length).toBe(64044);
    expect(sample(8000)).toBe(false);
  });
  it('records beyond two minutes and stops only on the teacher command', () => {
    const { send, sample, messages } = worklet(); send({ type: 'start' }); sample(16000 * 121);
    expect(messages.some(entry => entry.type === 'stopped')).toBe(false);
    send({ type: 'stop' });
    expect(messages.at(-1)).toEqual({ type: 'stopped', offsetMs: 121000 });
    expect(messages.filter(entry => entry.type === 'chunk').reduce((total, entry) => total + entry.chunk.length, 0)).toBe(16000 * 121);
  });
});
