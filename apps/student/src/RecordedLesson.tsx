import { useEffect, useId, useRef, useState } from 'react';
import { recordingAudioBytes, recordingCueAt, type LessonPackage, type LessonRecording } from '@coteacher/shared';
import { Sources, Visual } from './Visual';
import { ReplayVisual } from './ReplayVisual';

export function RecordedLesson({ lesson, recording, onPlayed, onOpenMoment, onExplainMoment, positionMs = 0, onPosition }: {
  lesson: LessonPackage; recording: LessonRecording; onPlayed?: () => void; onOpenMoment?: (stepId: string) => void;
  onExplainMoment?: (stepId: string) => void; positionMs?: number; onPosition?: (positionMs: number) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const seekId = useId();
  const [url, setUrl] = useState('');
  const [timeMs, setTimeMs] = useState(positionMs);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const resumeAt = useRef(positionMs);
  const lastSaved = useRef(positionMs);
  const positionCallback = useRef(onPosition); positionCallback.current = onPosition;
  function savePosition(force = false) {
    const current = Math.min(recording.durationMs, Math.max(0, Math.round((audio.current?.currentTime ?? 0) * 1000)));
    if (current !== lastSaved.current && (force || Math.abs(current - lastSaved.current) >= 5000)) {
      lastSaved.current = current; positionCallback.current?.(current);
    }
  }
  useEffect(() => {
    try {
      const next = URL.createObjectURL(new Blob([recordingAudioBytes(recording)], { type: recording.audio.mimeType }));
      setUrl(next); setError('');
      const element = audio.current;
      return () => { element?.pause(); URL.revokeObjectURL(next); };
    } catch (error) { setError((error as Error).message); }
  }, [recording.id, recording.audio]);
  useEffect(() => {
    if (!playing) return;
    let frame: number, lastFrame = 0;
    const update = (now: number) => {
      // Ten visual frames per second; encrypted checkpoints every five seconds.
      if (now - lastFrame >= 100 && audio.current && !audio.current.paused) { setTimeMs(audio.current.currentTime * 1000); lastFrame = now; }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    const pause = () => { audio.current?.pause(); savePosition(true); };
    const hidden = () => { if (document.hidden) pause(); };
    const otherAudio = (event: Event) => { if (event.target instanceof HTMLMediaElement && event.target !== audio.current) pause(); };
    document.addEventListener('play', otherAudio, true); document.addEventListener('visibilitychange', hidden);
    window.addEventListener('coteacher-lock', pause); window.addEventListener('pagehide', pause);
    return () => { document.removeEventListener('play', otherAudio, true); document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('coteacher-lock', pause); window.removeEventListener('pagehide', pause); };
  }, [recording.id]);
  const cue = recordingCueAt(recording, timeMs);
  const cueIndex = recording.cues.indexOf(cue);
  const selected = lesson.playback?.sequence[cueIndex];
  const asset = lesson.visualAssets?.find(entry => entry.id === selected?.visualAssetId);
  const step = lesson.timeline.find(entry => entry.id === cue.timelineStepId)!;
  const concept = lesson.concepts.find(entry => entry.id === cue.conceptId)!;
  function seek(ms: number) {
    if (!audio.current) return;
    const target = Math.max(0, Math.min(ms, recording.durationMs));
    audio.current.currentTime = target / 1000; setTimeMs(target); savePosition(true);
  }
  return <section className="recorded-lesson content-card" aria-label="Recorded classroom lesson" data-recorded-lesson-id={lesson.lessonId}
    data-recorded-step-id={step.id} data-recorded-concept-id={concept.id}>
    <p className="eyebrow">Teacher microphone recording · {recording.review.status === 'approved' ? 'Reviewed for learners' : 'Private review draft'}</p>
    <h2>{concept.title}</h2>
    {asset ? <ReplayVisual asset={asset} elapsedMs={timeMs - cue.offsetMs}/> : lesson.playback
      ? <p role="alert">The required visual is missing. Recollect the complete package before offline playback.</p> : <Visual conceptId={concept.id}/>}
    <audio ref={audio} src={url || undefined} controls preload="metadata" aria-label="Classroom audio"
      onLoadedMetadata={event => { const target = Math.min(resumeAt.current, recording.durationMs); event.currentTarget.currentTime = target / 1000; setTimeMs(target); }}
      onTimeUpdate={event => { setTimeMs(event.currentTarget.currentTime * 1000); savePosition(); }}
      onSeeked={event => { setTimeMs(event.currentTarget.currentTime * 1000); savePosition(true); }}
      onPlay={() => { setPlaying(true); onPlayed?.(); }}
      onPause={() => { setPlaying(false); savePosition(true); }} onEnded={() => { setPlaying(false); savePosition(true); }}
      onError={() => setError('This browser could not play the saved audio. Try current Chrome or Edge; the complete recording remains saved.')}/>
    <div className="replay-controls"><button onClick={() => seek(timeMs - 10000)}>Back 10 seconds</button>
      <button onClick={() => { if (audio.current?.paused) void audio.current.play().catch(() => setError('Tap the audio play control to start playback.')); else audio.current?.pause(); }}>{playing ? 'Pause lesson replay' : 'Play lesson replay'}</button>
      <button onClick={() => seek(timeMs + 10000)}>Forward 10 seconds</button></div>
    <label className="sr-only" htmlFor={seekId}>Seek recorded lesson</label>
    <input id={seekId} aria-label="Seek recorded lesson" type="range" min="0" max={recording.durationMs} step="100" value={Math.round(timeMs)} onChange={event => seek(Number(event.target.value))}/>
    {error && <p role="alert">{error}</p>}
    <p className="small">{(timeMs / 1000).toFixed(1)} / {(recording.durationMs / 1000).toFixed(1)} seconds. Audio is the captured explanation; the text below is the approved lesson aid, not a transcript.</p>
    {lesson.playback && <details><summary>About my visual presentation</summary><p>{lesson.playback.reason}</p><p>Prepared simulated personalization · no on-device AI. Highlights illustrate the concept; they do not follow individual spoken words.</p></details>}
    <p className="recorded-caption">{step.teacherSaid}</p><Sources lesson={lesson} refs={cue.sourceRefs}/>
    <details className="recorded-timeline" open={!lesson.playback}><summary>Recorded visual timeline</summary><nav aria-label="Recorded visual timeline"><ol>{recording.cues.map((entry, index) => <li key={index}>
      <button data-recorded-cue-index={index} data-timeline-step-id={entry.timelineStepId} data-concept-id={entry.conceptId}
        aria-current={cue === entry ? 'step' : undefined} onClick={() => seek(entry.offsetMs)}>{(entry.offsetMs / 1000).toFixed(2)}s · {lesson.concepts.find(item => item.id === entry.conceptId)!.title}</button>
    </li>)}</ol></nav></details>
    <div className="replay-controls">{onOpenMoment && <button onClick={() => { audio.current?.pause(); savePosition(true); onOpenMoment(step.id); }}>Study this exact concept</button>}
      {onExplainMoment && <button onClick={() => { audio.current?.pause(); savePosition(true); onExplainMoment(step.id); }}>Pause and explain this concept</button>}</div>
  </section>;
}
