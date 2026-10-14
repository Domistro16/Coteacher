import { useEffect, useRef, useState } from 'react';
import { approvePersonalizedVisuals, personalizedReplay, profiles, reviewRecording, type LessonPackage, type LessonRecording } from '@coteacher/shared';
import { RecordedLesson } from '../../student/src/RecordedLesson';
import { ReplayVisual } from '../../student/src/ReplayVisual';
import { readRecording, saveRecording } from './recording-storage';
import { startTeacherRecorder, type CaptureState, type TeacherRecorder } from './microphone-recorder';

export function RecordingPanel({ lesson, onLock, onPending, onTransitionBusy }: {
  lesson: LessonPackage; onLock: (locked: boolean) => void; onPending: (pending: boolean) => void; onTransitionBusy: (busy: boolean) => void;
}) {
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [state, setState] = useState<CaptureState | 'idle' | 'requesting'>('idle');
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [played, setPlayed] = useState(false);
  const [visualsReviewed, setVisualsReviewed] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState('');
  const recorder = useRef<TeacherRecorder | null>(null);
  const captureAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const latestLesson = useRef(lesson); latestLesson.current = lesson;
  const lastStep = useRef(lesson.classroomTimeline!.currentStepId);
  const locked = state !== 'idle' || !saved;
  const complete = Boolean(recording && lesson.timeline.every(step => recording.cues.some(cue => cue.timelineStepId === step.id)));
  useEffect(() => { onLock(locked); }, [locked, onLock]);
  useEffect(() => { onTransitionBusy(state === 'requesting' || state === 'saving'); }, [state, onTransitionBusy]);
  useEffect(() => {
    mounted.current = true;
    void readRecording(lesson).then(value => {
      if (!mounted.current) return;
      setRecording(value); onPending(Boolean(value && (value.review.status !== 'approved' || value.visualReview?.status !== 'approved')));
    }).catch(error => { if (mounted.current) { setError(error.message); onPending(true); } })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; captureAbort.current?.abort(); recorder.current?.dispose(); };
  }, []);
  useEffect(() => {
    const step = lesson.classroomTimeline!.currentStepId;
    if (lastStep.current !== step) { recorder.current?.cue(step); lastStep.current = step; }
  }, [lesson.classroomTimeline!.currentStepId]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (locked) { event.preventDefault(); event.returnValue = ''; } };
    const hidden = () => { if (document.hidden && state === 'recording') recorder.current?.pause(); };
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', hidden); };
  }, [locked, state]);
  async function persist(value: LessonRecording) {
    setSaved(false); onPending(true);
    try {
      await saveRecording(latestLesson.current, value);
      if (!mounted.current) return;
      setSaved(true); onPending(value.review.status !== 'approved' || value.visualReview?.status !== 'approved');
    } catch (error) { if (mounted.current) setError((error as Error).message); }
  }
  async function start() {
    setError(''); setState('requesting'); onLock(true);
    const abort = new AbortController(); captureAbort.current = abort;
    try {
      const capture = await startTeacherRecorder(latestLesson.current, {
        signal: abort.signal,
        state: (value, ms) => { if (mounted.current) { setState(value); setElapsed(ms); } },
        failed: error => { if (mounted.current) { setError(error.message); setState('idle'); recorder.current = null; } },
        stopped: value => {
          if (!mounted.current) return;
          recorder.current = null; setRecording(value); setState('idle'); setReviewed(false); setPlayed(false); setVisualsReviewed(false);
          void persist(value);
        },
      });
      if (!mounted.current || abort.signal.aborted) capture.dispose(); else recorder.current = capture;
    } catch (error) { if (mounted.current && !abort.signal.aborted) { setError((error as Error).message); setState('idle'); } }
  }
  return <section className="recording-panel content-card" aria-label="Teacher recording controls">
    <div className="recording-controls"><p role="status" className={`recording-status ${state === 'recording' ? 'live' : ''}`}>
      {state === 'requesting' ? 'Waiting for microphone permission…' : state === 'recording' ? 'Recording teacher microphone' : state === 'paused' ? 'Recording paused · microphone muted' : state === 'saving' ? 'Finalizing teacher audio…' : recording ? recording.review.status === 'approved' && saved ? recording.visualReview?.status === 'approved' ? 'Recording reviewed · ready for export' : 'Recording reviewed · review personalized visuals before export' : saved ? 'Recording saved · review before publishing' : 'Recording not saved · keep this tab open' : 'Microphone off'}
      {state !== 'idle' && ` · ${(elapsed / 1000).toFixed(1)}s`}</p>
      {state === 'idle' && !recording && <><label className="check"><input type="checkbox" checked={enabled} disabled={loading} onChange={event => setEnabled(event.target.checked)}/>Record my explanation only. I will pause for students and discussions.</label>
        <button className="primary" disabled={!enabled || loading} onClick={() => void start()}>Start audio recording</button></>}
      {state === 'recording' && <button onClick={() => recorder.current?.pause()}>Pause recording</button>}
      {state === 'requesting' && <button onClick={() => { captureAbort.current?.abort(); recorder.current?.dispose(); recorder.current = null; setState('idle'); }}>Cancel microphone request</button>}
      {state === 'paused' && <button className="primary" onClick={() => recorder.current?.resume(lesson.classroomTimeline!.currentStepId)}>Resume recording</button>}
      {['recording', 'paused'].includes(state) && <button onClick={() => recorder.current?.stop()}>Stop recording</button>}
    </div>
    {error && <p className="safety" role="alert">{error}</p>}
    {!recording && <p className="small recording-guidance">Use a close teacher microphone. Pause before classroom conversations. Mono compressed audio uses a 24 kb/s target and a 20 MB media budget; stopping saves a private draft on this device. No speech recognition.</p>}
    {recording && <div className="recording-review"><RecordedLesson lesson={lesson} recording={recording} onPlayed={() => setPlayed(true)}/>
      {!saved && <button onClick={() => { setError(''); void persist(recording); }}>Retry saving recording</button>}
      {recording.review.status === 'draft' && <><label className="check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>I reviewed the audio and visual timing against the sources. No student voices or private conversations are included.</label>
        <button className="primary" disabled={!saved || !reviewed || !played} onClick={() => {
          const next = reviewRecording(recording, reviewed); setRecording(next); setError(''); void persist(next);
        }}>Approve recording for learners</button><p className="small">Play the recording before approving it. Both personal packages retain the same recorded moments and learning objective.</p></>}
      {recording.review.status === 'approved' && <section aria-label="Personalized visual review">
        <h3>Review both visual presentations</h3><p className="small">Simulated rules select concrete diagrams for Student A and ordered ray annotations for Student B. Both hear this complete recording with the same objective. Check each preview against your voice; these prepared aids are not a transcript.</p>
        <div className="route-preview">{profiles.map(profile => {
          const preview = personalizedReplay({ ...lesson, studentId: profile.id }, recording);
          return <article key={profile.id}><h4>{profile.label}</h4><p>{preview.playback!.reason}</p>
            <RecordedLesson lesson={preview} recording={recording}/>
            <details><summary>All selected visuals for {profile.label}</summary>{preview.visualAssets!.map(asset => <div key={asset.id}><ReplayVisual asset={asset}/><p>{asset.sourceRefs.join(', ')}</p></div>)}</details>
          </article>;
        })}</div>
        {recording.visualReview?.status !== 'approved' ? <><label className="check"><input type="checkbox" checked={visualsReviewed} onChange={event => setVisualsReviewed(event.target.checked)}/>I reviewed both personalized visual sequences against the recording and approved sources.</label>
          <button className="primary" disabled={!saved || !visualsReviewed || !complete} onClick={() => {
            const next = approvePersonalizedVisuals(recording, visualsReviewed); setRecording(next); setError(''); void persist(next);
          }}>Approve personalized playback</button></> : <p role="status">Both personalized visual sequences approved</p>}
        {!complete && <p role="alert">This recording does not cover every lesson concept. Delete this attempt and record the complete lesson before publishing personalized playback.</p>}
      </section>}
      <button disabled={loading} onClick={() => {
        setError(''); setLoading(true);
        void saveRecording(lesson, null).then(() => { setRecording(null); setSaved(true); onPending(false); setEnabled(false); setElapsed(0); setPlayed(false); setReviewed(false); })
          .catch(error => setError(error.message)).finally(() => setLoading(false));
      }}>Delete recording</button>
      <p className="small">Audio and timeline saved together on this teacher device. Export after recording review. Keep a downloaded personal package as a backup.</p>
    </div>}
  </section>;
}
