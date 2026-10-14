import { useEffect, useRef, useState } from 'react';
import { approvePersonalizedVisuals, personalizedReplay, profiles, reviewRecording, type LessonPackage, type LessonRecording } from '@coteacher/shared';
import { RecordedLesson } from '../../student/src/RecordedLesson';
import { ReplayVisual } from '../../student/src/ReplayVisual';
import { Sources } from '../../student/src/Visual';
import { readRecording, saveRecording } from './recording-storage';
import { startTeacherRecorder, type CaptureState, type TeacherRecorder } from './microphone-recorder';
import type { PresentationMotion } from './projector-channel';

export function RecordingPanel({ lesson, onLock, onPending, onTransitionBusy, onMotion, mode = 'studio', onReview, onRerecord, onChanged }: {
  lesson: LessonPackage; onLock: (locked: boolean) => void; onPending: (pending: boolean) => void; onTransitionBusy: (busy: boolean) => void;
  mode?: 'studio' | 'review'; onReview?: () => void; onRerecord?: () => void; onChanged?: () => void;
  onMotion: (motion: PresentationMotion | null) => void;
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
  const [previewProfile, setPreviewProfile] = useState<string>('default');
  const recorder = useRef<TeacherRecorder | null>(null);
  const captureAbort = useRef<AbortController | null>(null);
  const reviewAfterSave = useRef(false);
  const [checking, setChecking] = useState(false);
  const [micCheck, setMicCheck] = useState('');
  const checkAbort = useRef(false);
  const motionClock = useRef({ position: 0, offset: 0, stepId: lesson.classroomTimeline!.currentStepId, running: false });
  function publishMotion() { const clock = motionClock.current; onMotion({ stepId: clock.stepId, elapsedMs: Math.max(0, clock.position - clock.offset), running: clock.running }); }
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
    return () => { mounted.current = false; checkAbort.current = true; captureAbort.current?.abort(); recorder.current?.dispose(); onMotion(null); };
  }, []);
  useEffect(() => {
    const step = lesson.classroomTimeline!.currentStepId;
    if (lastStep.current !== step) { recorder.current?.cue(step); lastStep.current = step; }
  }, [lesson.classroomTimeline!.currentStepId]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (locked) { event.preventDefault(); event.returnValue = ''; } };
    // Changing display/window focus must not change the teacher's recording state.
    // The explicit Pause button mutes capture before classroom conversations.
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('beforeunload', beforeUnload); };
  }, [locked, state]);
  async function persist(value: LessonRecording) {
    setSaved(false); onPending(true);
    try {
      await saveRecording(latestLesson.current, value);
      if (!mounted.current) return;
      setSaved(true); onPending(value.review.status !== 'approved' || value.visualReview?.status !== 'approved'); onChanged?.();
      if (reviewAfterSave.current) { reviewAfterSave.current = false; onReview?.(); }
    } catch (error) { if (mounted.current) setError((error as Error).message); }
  }
  async function start() {
    if (captureAbort.current && !captureAbort.current.signal.aborted) return;
    setError(''); setState('requesting'); onLock(true);
    motionClock.current = { position: 0, offset: 0, stepId: latestLesson.current.classroomTimeline!.currentStepId, running: false }; publishMotion();
    const abort = new AbortController(); captureAbort.current = abort;
    try {
      const existing = await readRecording(latestLesson.current);
      if (!mounted.current || abort.signal.aborted) return;
      if (existing) {
        onMotion(null);
        captureAbort.current = null; setRecording(existing); setState('idle');
        onPending(existing.review.status !== 'approved' || existing.visualReview?.status !== 'approved');
        setError('A recording was saved in another studio. Review it before choosing to delete and rerecord.');
        return;
      }
      const capture = await startTeacherRecorder(latestLesson.current, {
        signal: abort.signal,
        state: (value, ms) => { if (mounted.current) { setState(value); setElapsed(ms); motionClock.current.position = ms; motionClock.current.running = value === 'recording'; publishMotion(); } },
        visual: cue => { if (mounted.current) { motionClock.current.offset = cue.offsetMs; motionClock.current.stepId = cue.timelineStepId; publishMotion(); } },
        failed: error => { if (mounted.current) { onMotion(null); captureAbort.current = null; setError(error.message); setState('idle'); recorder.current = null; } },
        stopped: value => {
          if (!mounted.current) return;
          recorder.current = null; captureAbort.current = null; reviewAfterSave.current = true;
          onMotion(null);
          setRecording(value); setState('idle'); setReviewed(false); setPlayed(false); setVisualsReviewed(false);
          void persist(value);
        },
      });
      if (!mounted.current || abort.signal.aborted) capture.dispose(); else recorder.current = capture;
    } catch (error) { if (mounted.current && !abort.signal.aborted) { onMotion(null); captureAbort.current = null; setError((error as Error).message); setState('idle'); } }
  }
  async function checkMicrophone() {
    if (checking || state !== 'idle') return;
    setChecking(true); setError(''); setMicCheck(''); checkAbort.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs HTTPS or localhost in a supported browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      const usable = stream.getAudioTracks().some(track => track.readyState === 'live');
      stream.getTracks().forEach(track => track.stop());
      if (!checkAbort.current && mounted.current) setMicCheck(usable ? 'Microphone access checked · microphone off' : 'No usable microphone found.');
    } catch { if (!checkAbort.current && mounted.current) setError('Microphone access could not be checked. Allow microphone permission and check your input device.'); }
    finally { if (mounted.current) setChecking(false); }
  }
  return <section className="recording-panel content-card" aria-label="Teacher recording controls">
    <div className="recording-controls"><p role="status" className={`recording-status ${state === 'recording' ? 'live' : ''}`}>
      {state === 'requesting' ? 'Waiting for microphone permission…' : state === 'recording' ? 'Recording teacher microphone' : state === 'paused' ? 'Recording paused · microphone muted' : state === 'saving' ? 'Finalizing teacher audio…' : recording ? recording.review.status === 'approved' && saved ? recording.visualReview?.status === 'approved' ? 'Recording reviewed · ready for export' : 'Recording reviewed · review personalized visuals before export' : saved ? 'Recording saved · review before publishing' : 'Recording not saved · keep this tab open' : 'Microphone off'}
      {state !== 'idle' && <time className="recording-timer" aria-label="Recording duration">{`${Math.floor(elapsed / 60000).toString().padStart(2, '0')}:${Math.floor(elapsed / 1000 % 60).toString().padStart(2, '0')}`}</time>}</p>
      {mode === 'studio' && state === 'idle' && !recording && <><label className="check"><input type="checkbox" checked={enabled} disabled={loading} onChange={event => setEnabled(event.target.checked)}/>Record my explanation only. Pause for discussions.</label>
        <button disabled={checking || loading} onClick={() => void checkMicrophone()}>{checking ? 'Checking microphone…' : 'Check microphone access'}</button>
        <button className="primary" disabled={!enabled || loading || checking} onClick={() => void start()}>Start audio recording</button></>}
      {state === 'recording' && <button onClick={() => recorder.current?.pause()}>Pause recording</button>}
      {state === 'requesting' && <button onClick={() => { captureAbort.current?.abort(); recorder.current?.dispose(); recorder.current = null; onMotion(null); setState('idle'); }}>Cancel microphone request</button>}
      {state === 'paused' && <button className="primary" onClick={() => recorder.current?.resume(lesson.classroomTimeline!.currentStepId)}>Resume recording</button>}
      {['recording', 'paused'].includes(state) && <button className="stop-recording" onClick={() => recorder.current?.stop()}>Stop and save recording</button>}
    </div>
    {error && <p className="safety" role="alert">{error}</p>}
    {!recording && state === 'idle' && <p className="small recording-guidance">{micCheck || 'Check access, then start. Use a close teacher microphone; pause for discussions.'}</p>}
    {recording && mode === 'studio' && <button className="primary" disabled={!saved} onClick={onReview}>Review your lesson</button>}
    {recording && (mode === 'review' || !saved) && <div className="recording-review">
      <label htmlFor="preview-learner">Preview learner presentation</label><select id="preview-learner" value={previewProfile} onChange={event => setPreviewProfile(event.target.value)}><option value="default">Default · insufficient history</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label} · simulated history</option>)}</select>
      <RecordedLesson immersive lesson={personalizedReplay({ ...lesson, studentId: previewProfile === 'default' ? lesson.studentId : previewProfile }, recording, previewProfile === 'default' ? {} : undefined)} recording={recording} onPlayed={() => setPlayed(true)}/>
      {!saved && <button onClick={() => { setError(''); void persist(recording); }}>Retry saving recording</button>}
      {recording.review.status === 'draft' && <><label className="check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>I reviewed the audio and visual timing against the sources. No student voices or private conversations are included.</label>
        <button className="primary" disabled={!saved || !reviewed || !played} onClick={() => {
          const next = reviewRecording(recording, reviewed); setRecording(next); setError(''); void persist(next);
        }}>Approve recording for learners</button><p className="small">Play the recording before approving it. Both personal packages retain the same recorded moments and learning objective.</p></>}
      {recording.review.status === 'approved' && <section aria-label="Personalized visual review">
        <h3>Review both visual presentations</h3><p className="small">Simulated rules select concrete diagrams for Student A and ordered ray annotations for Student B. Both hear this complete recording with the same objective. Check each preview against your voice; these prepared aids are not a transcript.</p>
        <div className="route-preview single-preview">{profiles.filter(profile => profile.id === previewProfile).map(profile => {
          const preview = personalizedReplay({ ...lesson, studentId: profile.id }, recording);
          return <article key="personalized-preview"><h4>{profile.label}</h4><p>{preview.playback!.reason}</p>
            <details><summary>Playback and help visuals for {profile.label}</summary>{preview.visualAssets!.map(asset => <div key={asset.id}><ReplayVisual asset={asset}/><Sources lesson={preview} refs={asset.sourceRefs}/></div>)}</details>
          </article>;
        })}</div>
        <details><summary>Default sequence when history is insufficient</summary><p>The prepared concrete diagrams are the default. The same approved audio, objective and cues are retained.</p>
          <p>Select Default above to replay that sequence at the same timestamp.</p></details>
        {recording.visualReview?.status !== 'approved' ? <><label className="check"><input type="checkbox" checked={visualsReviewed} onChange={event => setVisualsReviewed(event.target.checked)}/>I reviewed both personalized visual sequences, the default and packaged help visuals against the recording and approved sources.</label>
          <button className="primary" disabled={!saved || !visualsReviewed || !complete} onClick={() => {
            const next = approvePersonalizedVisuals(recording, visualsReviewed); setRecording(next); setError(''); void persist(next);
          }}>Approve personalized playback</button></> : <p role="status">Both personalized visual sequences approved</p>}
        {!complete && <p role="alert">This recording does not cover every lesson concept. Delete this attempt and record the complete lesson before publishing personalized playback.</p>}
      </section>}
      <button disabled={loading} onClick={() => {
        setError(''); setLoading(true);
        void saveRecording(lesson, null).then(() => { setRecording(null); setSaved(true); reviewAfterSave.current = false; onPending(false); onChanged?.(); setEnabled(false); setElapsed(0); setPlayed(false); setReviewed(false); onRerecord?.(); })
          .catch(error => setError(error.message)).finally(() => setLoading(false));
      }}>Delete recording and rerecord</button>
      <p className="small">Audio and timeline saved together on this teacher device. Export after recording review. Keep a downloaded personal package as a backup.</p>
    </div>}
  </section>;
}
