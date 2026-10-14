import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { recordingAudioBytes, recordingCueAt, type LessonPackage, type LessonRecording, type PlayerState } from '@coteacher/shared';
import { Sources, Visual } from './Visual';
import { ReplayVisual } from './ReplayVisual';
import { Icon, clock } from './student-ui';
import { CompanionToolsTarget } from './CompanionDock';

export function RecordedLesson({ lesson, recording, onPlayed, onOpenMoment, onExplainMoment, onExploreVisual, onCheckMoment, onActivityMoment, support, positionMs = 0, onPosition, immersive = false, companion, supportTimeMs = 4500 }: {
  companion?: ReactNode; supportTimeMs?: number;
  immersive?: boolean;
  lesson: LessonPackage; recording: LessonRecording; onPlayed?: () => void; onOpenMoment?: (stepId: string) => void;
  onExplainMoment?: (stepId: string, positionMs: number, detail?: string) => void;
  onExploreVisual?: (visualAssetId: string, positionMs: number) => void; onCheckMoment?: (stepId: string) => void;
  onActivityMoment?: (stepId: string) => void;
  support?: NonNullable<PlayerState['recording']>['support']; positionMs?: number; onPosition?: (positionMs: number) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [companionToolsTarget, setCompanionToolsTarget] = useState<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [speed, setSpeed] = useState("1");
  const seekId = useId();
  const helpId = useId();
  const [detail, setDetail] = useState('');
  const [url, setUrl] = useState('');
  const [timeMs, setTimeMs] = useState(positionMs);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const resumeAt = useRef(positionMs);
  const lastSaved = useRef(positionMs);
  const positionCallback = useRef(onPosition); positionCallback.current = onPosition;
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  function savePosition(force = false) {
    if (!audio.current || !Number.isFinite(audio.current.duration)) return;
    const current = Math.min(recording.durationMs, Math.max(0, Math.round((audio.current?.currentTime ?? 0) * 1000)));
    if (current !== lastSaved.current && (force || Math.abs(current - lastSaved.current) >= 5000)) {
      lastSaved.current = current; positionCallback.current?.(current);
    }
  }
  useEffect(() => {
    const element = audio.current;
    resumeAt.current = element && Number.isFinite(element.duration) ? Math.round(element.currentTime * 1000) : positionMs;
    try {
      if ('mediaUrl' in recording.audio) {
        setUrl(recording.audio.mediaUrl); setError('');
        return () => { element?.pause(); };
      }
      const next = URL.createObjectURL(new Blob([recordingAudioBytes(recording)], { type: recording.audio.mimeType }));
      setUrl(next); setError('');
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
    const resume = () => { void audio.current?.play().catch(() => setError('Tap Play lesson replay to continue.')); };
    const hidden = () => { if (document.hidden) pause(); };
    const otherAudio = (event: Event) => { if (event.target instanceof HTMLMediaElement && event.target !== audio.current) pause(); };
    document.addEventListener('play', otherAudio, true); document.addEventListener('visibilitychange', hidden);
    window.addEventListener('coteacher-lock', pause); window.addEventListener('pagehide', pause);
    window.addEventListener('coteacher-pause-recording', pause); window.addEventListener('coteacher-resume-recording', resume);
    return () => { document.removeEventListener('play', otherAudio, true); document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('coteacher-lock', pause); window.removeEventListener('pagehide', pause);
      window.removeEventListener('coteacher-pause-recording', pause); window.removeEventListener('coteacher-resume-recording', resume); };
  }, [recording.id]);
  const cue = recordingCueAt(recording, timeMs);
  const cueIndex = recording.cues.indexOf(cue);
  const selected = lesson.playback?.sequence[cueIndex];
  const asset = lesson.visualAssets?.find(entry => entry.id === selected?.visualAssetId);
  const step = lesson.timeline.find(entry => entry.id === cue.timelineStepId)!;
  const concept = lesson.concepts.find(entry => entry.id === cue.conceptId)!;
  const supportAsset = !playing && support?.timelineStepId === step.id
    ? lesson.visualAssets?.find(entry => entry.id === support.visualAssetId && entry.conceptId === concept.id) : undefined;
  function pauseAtMoment() {
    audio.current?.pause(); savePosition(true);
    const position = Math.min(recording.durationMs, Math.max(0, Math.round((audio.current?.currentTime ?? 0) * 1000)));
    return { position, stepId: recordingCueAt(recording, position).timelineStepId };
  }
  useEffect(() => {
    if (!onExplainMoment) return;
    const interrupt = (event: Event) => {
      const request = (event as CustomEvent<{ recordingId: string }>).detail;
      if (request?.recordingId !== recording.id) return;
      const moment = pauseAtMoment();
      onExplainMoment(moment.stepId, moment.position);
    };
    window.addEventListener('coteacher-explain-recording', interrupt);
    return () => window.removeEventListener('coteacher-explain-recording', interrupt);
  }, [recording.id, onExplainMoment]);
  function seek(ms: number) {
    if (!audio.current) return;
    const target = Math.max(0, Math.min(ms, recording.durationMs));
    audio.current.currentTime = target / 1000; setTimeMs(target); savePosition(true);
  }

  const media = <audio ref={audio} src={url || undefined} controls={!immersive} preload="metadata" aria-label="Classroom audio"
      onLoadedMetadata={event => { const target = Math.min(resumeAt.current, recording.durationMs); event.currentTarget.currentTime = target / 1000; event.currentTarget.playbackRate = Number(speed); setTimeMs(target); }}
      onTimeUpdate={event => { setTimeMs(event.currentTarget.currentTime * 1000); savePosition(); }}
      onSeeked={event => { setTimeMs(event.currentTarget.currentTime * 1000); savePosition(true); }}
      onPlay={() => { setPlaying(true); onPlayed?.(); }}
      onPause={() => { setPlaying(false); savePosition(true); }} onEnded={() => { setPlaying(false); savePosition(true); }}
      onError={() => setError('mediaUrl' in recording.audio ? 'The streamed recording is unavailable. Connect to the lesson service or download the complete lesson while connected.' : 'This browser could not play the saved audio. Try current Chrome or Edge; the complete recording remains saved.')}/>;
  function togglePlay() { if (audio.current?.paused) void audio.current.play().catch(() => setError('Playback could not start. Try Play again, or check that the complete recording is available.')); else audio.current?.pause(); }
  if (immersive) return <CompanionToolsTarget.Provider value={companionToolsTarget}>
    <section ref={stage} className={`recorded-lesson immersive-player${expanded ? ' expanded-player' : ''}${companion ? ' has-companion' : ''}`} aria-label="Recorded classroom lesson" data-recorded-lesson-id={lesson.lessonId} data-recorded-step-id={step.id} data-recorded-concept-id={concept.id}>
      <div className="stage-heading"><span className="stage-live">YOUR CLASSROOM, REPLAYED</span><span>{concept.title}</span></div>
      {companion && supportAsset ? <div className="recorded-help" aria-label="Prepared visual support" data-support-step-id={cue.timelineStepId} data-support-asset-id={supportAsset.id}>
        <ReplayVisual asset={supportAsset} elapsedMs={supportTimeMs} compact readable/>
      </div> : asset ? <ReplayVisual asset={asset} elapsedMs={timeMs - cue.offsetMs} compact readable/> : <p role="alert">This lesson is missing its visual. Download the complete package again.</p>}
      {media}
      {!playing && !companion && <button className="stage-play" aria-label="Start watching" onClick={togglePlay}><Icon name="play" size={32}/></button>}
      <div className="player-controls"><label className="sr-only" htmlFor={seekId}>Seek recorded lesson</label><input id={seekId} aria-label="Seek recorded lesson" type="range" min="0" max={recording.durationMs} step="100" value={Math.round(timeMs)} onChange={event => seek(Number(event.target.value))}/>
        <div className="control-row"><button aria-label={playing ? 'Pause lesson replay' : 'Play lesson replay'} onClick={togglePlay}><Icon name={playing ? 'pause' : 'play'}/></button>
          <button aria-label="Back 10 seconds" onClick={() => seek(timeMs - 10000)}><Icon name="back"/><small>10</small></button><button aria-label="Forward 10 seconds" onClick={() => seek(timeMs + 10000)}><Icon name="next"/><small>10</small></button>
          <span className="player-time">{clock(timeMs)} <span>/ {clock(recording.durationMs)}</span></span><span className="control-spacer"/>
          <label className="sr-only" htmlFor={seekId+'-speed'}>Playback speed</label><select id={seekId+'-speed'} aria-label="Playback speed" value={speed} onChange={event => { setSpeed(event.target.value); if (audio.current) audio.current.playbackRate = Number(event.target.value); }}>{['0.75','1','1.25','1.5'].map(value => <option key={value} value={value}>{value}×</option>)}</select>
          <button aria-label={expanded || fullscreen ? 'Exit expanded view' : 'Expand lesson player'} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else if (stage.current?.requestFullscreen) void stage.current.requestFullscreen().catch(() => setExpanded(!expanded)); else setExpanded(!expanded); }}><Icon name="expand"/></button>
        </div></div>
      {error && <p className="player-error" role="alert">{error}</p>}
      {companion}
    </section>
    <div ref={setCompanionToolsTarget} className="companion-tools-target"/>
    <div className="watch-actions">{onExplainMoment && <button className="help-cta" onClick={() => { const moment = pauseAtMoment(); onExplainMoment(moment.stepId, moment.position); }}><Icon name="spark"/>I don’t understand</button>}<button onClick={() => seek(cue.offsetMs)}><Icon name="back"/>Replay this section</button>{onCheckMoment && <button onClick={() => { const moment = pauseAtMoment(); onCheckMoment(moment.stepId); }}><Icon name="check"/>Check this concept</button>}</div>
    <section className="chapters"><div className="section-heading"><h2>In this lesson</h2><span>{recording.cues.length} classroom moments</span></div><nav aria-label="Recorded visual timeline">{recording.cues.map((entry, index) => <button key={index} data-recorded-cue-index={index} data-timeline-step-id={entry.timelineStepId} data-concept-id={entry.conceptId} aria-current={cue === entry ? 'step' : undefined} onClick={() => seek(entry.offsetMs)}><span className="chapter-number">{String(index + 1).padStart(2,'0')}</span><span>{lesson.concepts.find(item => item.id === entry.conceptId)!.title}<small>{clock(entry.offsetMs)}</small></span><Icon name="play" size={17}/></button>)}</nav></section>
    <details className="player-about"><summary>About this lesson</summary><p>{lesson.objective.text}</p><p>{lesson.playback?.reason}</p><p>Prepared personalization for simulated profiles. Your teacher’s original audio is unchanged. Captions are not available for this recording.</p><Sources lesson={lesson} refs={cue.sourceRefs}/></details>
  </CompanionToolsTarget.Provider>;

  return <section className="recorded-lesson content-card" aria-label="Recorded classroom lesson" data-recorded-lesson-id={lesson.lessonId}
    data-recorded-step-id={step.id} data-recorded-concept-id={concept.id}>
    <p className="eyebrow">Teacher microphone recording · {recording.review.status === 'approved' ? 'mediaUrl' in recording.audio ? 'Streaming from lesson service' : 'Available on this device' : 'Private review draft'}</p>
    <h2>{concept.title}</h2>
    {asset ? <ReplayVisual asset={asset} elapsedMs={timeMs - cue.offsetMs}/> : lesson.playback
      ? <p role="alert">The required visual is missing. Recollect the complete package before offline playback.</p> : <Visual conceptId={concept.id} elapsedMs={timeMs - cue.offsetMs} sourceRefs={step.sourceRefs}/>}
    {media}
    <div className="replay-controls"><button onClick={() => seek(timeMs - 10000)}>Back 10 seconds</button>
      <button onClick={() => { if (audio.current?.paused) void audio.current.play().catch(() => setError('Tap the audio play control to start playback.')); else audio.current?.pause(); }}>{playing ? 'Pause lesson replay' : 'Play lesson replay'}</button>
      <button onClick={() => seek(timeMs + 10000)}>Forward 10 seconds</button></div>
    <label className="sr-only" htmlFor={seekId}>Seek recorded lesson</label>
    <input id={seekId} aria-label="Seek recorded lesson" type="range" min="0" max={recording.durationMs} step="100" value={Math.round(timeMs)} onChange={event => seek(Number(event.target.value))}/>
    {error && <p role="alert">{error}</p>}
    <p className="small">{(timeMs / 1000).toFixed(1)} / {(recording.durationMs / 1000).toFixed(1)} seconds. Audio is the captured explanation; the text below is the approved lesson aid, not a transcript.</p>
    {lesson.playback && <details><summary>About my visual presentation</summary><p>{lesson.playback.reason}</p><p>Prepared simulated personalization · no on-device AI. Highlights illustrate the concept; they do not follow individual spoken words.</p></details>}
    <details className="recorded-reference"><summary>Sources and approved concept aid</summary><p className="recorded-caption">{step.teacherSaid}</p><Sources lesson={lesson} refs={cue.sourceRefs}/></details>
    <details className="recorded-timeline" open={!lesson.playback}><summary>Recorded visual timeline</summary><nav aria-label="Recorded visual timeline"><ol>{recording.cues.map((entry, index) => <li key={index}>
      <button data-recorded-cue-index={index} data-timeline-step-id={entry.timelineStepId} data-concept-id={entry.conceptId}
        aria-current={cue === entry ? 'step' : undefined} onClick={() => seek(entry.offsetMs)}>{(entry.offsetMs / 1000).toFixed(2)}s · {lesson.concepts.find(item => item.id === entry.conceptId)!.title}</button>
    </li>)}</ol></nav></details>
    <div className="replay-controls">{onOpenMoment && <button onClick={() => { const moment = pauseAtMoment(); onOpenMoment(moment.stepId); }}>Study this exact concept</button>}
      {onExplainMoment && <button onClick={() => { const moment = pauseAtMoment(); onExplainMoment(moment.stepId, moment.position); }}>Pause and explain this concept</button>}
      {onCheckMoment && <button onClick={() => { const moment = pauseAtMoment(); onCheckMoment(moment.stepId); }}>Check this concept</button>}
      {onActivityMoment && concept.variants.some(variant => variant.type === 'tryit') && <button onClick={() => { const moment = pauseAtMoment(); onActivityMoment(moment.stepId); }}>Pause and try the activity</button>}</div>
    {onExplainMoment && lesson.playback && <form onSubmit={event => {
      event.preventDefault(); if (!detail.trim()) return;
      const moment = pauseAtMoment(); onExplainMoment(moment.stepId, moment.position, detail); setDetail('');
    }}><label htmlFor={helpId}>Which part of this recorded concept is unclear?</label>
      <textarea id={helpId} maxLength={1500} rows={2} value={detail} onChange={event => setDetail(event.target.value)}/>
      <button disabled={!detail.trim()}>Pause and ask about this part</button></form>}
    {supportAsset && <section className="recorded-help" aria-label="Prepared visual support" data-support-step-id={step.id} data-support-asset-id={supportAsset.id}>
      <h3>Another representation of this concept</h3><p>Prepared support while the recording is paused. Your explanation and check are below; the original audio and timeline are preserved.</p>
      <ReplayVisual asset={supportAsset} elapsedMs={timeMs - cue.offsetMs}/><Sources lesson={lesson} refs={supportAsset.sourceRefs}/>
      <p className="small">Suggestions use your own history of prepared representations. You can choose another below. These are deterministic choices, not learned AI.</p>
      {onExploreVisual && <nav aria-label="Prepared concept representations">{lesson.visualAssets!.filter(entry => entry.conceptId === concept.id).map(entry =>
        <button key={entry.id} aria-pressed={entry.id === supportAsset.id} onClick={() => { const moment = pauseAtMoment(); onExploreVisual(entry.id, moment.position); }}>{entry.title}</button>)}</nav>}
      <button className="primary" onClick={() => void audio.current?.play().catch(() => setError('Tap the audio play control to resume the recorded lesson.'))}>Return to recorded lesson</button>
    </section>}
  </section>;
}
