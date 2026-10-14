import { audioBase64, checkRecordingAudio, cueForStep, requirePublishedLesson,
  type LessonPackage, type LessonRecording, type RecordingCue } from '@coteacher/shared';
import { createOpusEncoder } from './opus-encoder';

export type CaptureState = 'recording' | 'paused' | 'saving';
export interface TeacherRecorder { cue(stepId: string): void; pause(): void; resume(stepId: string): void; stop(): void; dispose(): void }

export async function startTeacherRecorder(lesson: LessonPackage, callbacks: {
  state: (state: CaptureState, elapsedMs: number) => void;
  stopped: (recording: LessonRecording) => void;
  failed: (error: Error) => void;
  signal?: AbortSignal;
}): Promise<TeacherRecorder> {
  requirePublishedLesson(lesson);
  if (!lesson.classroomTimeline) throw new Error('Start the approved presentation before recording.');
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw new Error('Microphone recording needs HTTPS or localhost and a browser supporting AudioWorklet.');
  }
  const encoder = await createOpusEncoder();
  const context = new AudioContext({ sampleRate: 48000 });
  let stream: MediaStream | undefined;
  let node: AudioWorkletNode | undefined;
  let disposed = false;
  let stopping = false;
  let state: CaptureState = 'recording';
  let elapsed = 0;
  const cues: RecordingCue[] = [];
  const startedAt = new Date().toISOString();
  const release = () => {
    disposed = true;
    callbacks.signal?.removeEventListener('abort', release);
    stream?.getTracks().forEach(track => track.stop());
    node?.disconnect();
    encoder.close();
    void context.close().catch(() => {});
  };
  const fail = (error: unknown) => { if (disposed) return; release(); callbacks.failed(error instanceof Error ? error : new Error('Microphone capture failed.')); };
  callbacks.signal?.addEventListener('abort', release, { once: true });
  try {
    if (callbacks.signal?.aborted) throw new DOMException('Capture cancelled', 'AbortError');
    // Permission is requested only after the teacher explicitly enables capture.
    stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    if (disposed) { stream.getTracks().forEach(track => track.stop()); throw new DOMException('Capture cancelled', 'AbortError'); }
    await context.audioWorklet.addModule(new URL('../audio-capture-worklet.js', import.meta.url).href);
    // The module URL is rewritten by Vite; source is shared with unit tests.
    await context.resume();
    if (context.state !== 'running') throw new Error('Audio input could not start. Check your microphone and retry.');
    node = new AudioWorkletNode(context, 'teacher-audio-capture', { channelCount: 1, channelCountMode: 'explicit' });
    context.createMediaStreamSource(stream).connect(node);
    node.connect(context.destination);
    node.onprocessorerror = () => fail(new Error('Audio capture stopped unexpectedly. Discard this attempt and retry.'));
    stream.getAudioTracks().forEach(track => { track.onended = () => fail(new Error('Microphone disconnected. This attempt was not saved.')); });
    node.port.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.type === 'chunk') {
        try { encoder.add(data.chunk); } catch (error) { fail(error); return; }
        elapsed = data.offsetMs; callbacks.state(state, elapsed);
      }
      if (data.type === 'cue') {
        if (cues.length >= 1000) { fail(new Error('Recording timeline limit reached. Retry with fewer visual transitions.')); return; }
        cues.push(data.cue);
      }
      if (data.type === 'state') { state = data.state; elapsed = data.offsetMs; callbacks.state(state, elapsed); }
      if (data.type === 'stopped') {
        callbacks.state('saving', data.offsetMs);
        // Permission ends immediately on Stop; encoder flushing does not keep capture live.
        stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
        void encoder.finish().then(({ bytes, durationMs }) => {
          if (disposed) return;
          const recording: LessonRecording = {
            id: 'recording-' + crypto.randomUUID(), lessonId: lesson.lessonId,
            lessonApprovedAt: lesson.publication.status === 'approved' ? lesson.publication.approvedAt : '',
            classroomSessionId: lesson.classroomTimeline!.sessionId, startedAt, durationMs,
            origin: 'teacher-microphone', audio: { mimeType: 'audio/ogg;codecs=opus', sampleRate: 48000, channels: 1,
              dataBase64: audioBase64(bytes), mediaKey: audioBase64(crypto.getRandomValues(new Uint8Array(32))) },
            cues: cues.map(cue => ({ ...cue, offsetMs: Math.min(cue.offsetMs, durationMs) })) as LessonRecording['cues'],
            review: { status: 'draft' },
            visualReview: { status: 'draft' },
          };
          if (!checkRecordingAudio(recording)) throw new Error('No audible microphone signal was captured. Check the input and record again; a silent slideshow cannot be published.');
          release(); callbacks.stopped(recording);
        }).catch(fail);
      }
    };
    node.port.postMessage({ type: 'start', cue: cueForStep(lesson, lesson.classroomTimeline.currentStepId, 0) });
  } catch (error) {
    release();
    if (error instanceof DOMException && error.name === 'NotAllowedError') throw new Error('Microphone permission was denied. Allow the teacher microphone in browser settings, then retry.');
    if (error instanceof DOMException && ['NotSupportedError', 'NotReadableError', 'NotFoundError'].includes(error.name)) {
      throw new Error('The browser could not open a supported teacher microphone. Check your input device and browser settings, then retry.');
    }
    throw error;
  }
  return {
    cue: stepId => { if (!disposed && !stopping) node!.port.postMessage({ type: 'cue', cue: cueForStep(lesson, stepId, 0) }); },
    pause: () => { if (disposed || stopping) return; stream!.getAudioTracks().forEach(track => { track.enabled = false; }); node!.port.postMessage({ type: 'pause' }); },
    resume: stepId => {
      if (disposed || stopping) return;
      void context.resume().then(() => {
        if (disposed || stopping) return;
        stream!.getAudioTracks().forEach(track => { track.enabled = true; });
        node!.port.postMessage({ type: 'resume', cue: cueForStep(lesson, stepId, 0) });
      }).catch(fail);
    },
    stop: () => { if (disposed || stopping) return; stopping = true; node!.port.postMessage({ type: 'stop' }); },
    dispose: release,
  };
}
