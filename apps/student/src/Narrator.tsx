import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import manifest from '../../../fixtures/demo-lesson/narration.json' with { type: 'json' };
import { createNarration, initialNarrationState, type Narration, type NarrationFrame } from './narration';

export function preparedClip(text: string): string | undefined {
  const path = (manifest.clips as Record<string, string>)[text];
  return path && /^audio\/[0-9a-f]{20}\.mp3$/.test(path) ? '/' + path : undefined;
}
export interface NarratorHandle { pause(): void; replay(): void }
export const Narrator = forwardRef<NarratorHandle, { frames: NarrationFrame[]; sources: (refs: readonly string[]) => React.ReactNode }>(function Narrator({ frames, sources }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const engine = useRef<Narration | null>(null);
  const [state, setState] = useState(initialNarrationState);
  useEffect(() => {
    engine.current = createNarration({ audio: audio.current!, synthesis: window.speechSynthesis,
      utterance: text => new SpeechSynthesisUtterance(text), clip: preparedClip }, setState);
    return () => { engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { engine.current?.load(frames.map(frame => frame.text)); }, [frames]);
  useEffect(() => {
    const hide = () => { if (document.hidden) engine.current?.pause(); };
    const lock = () => engine.current?.disable();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('coteacher-lock', lock);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('coteacher-lock', lock); };
  }, []);
  useImperativeHandle(ref, () => ({ pause: () => engine.current?.pause(), replay: () => engine.current?.replay() }), []);
  const current = frames.find(frame => frame.text === state.caption);
  return <section className="narrator" aria-label="Spoken lesson">
    <p className="eyebrow">Coteacher speaks · Captions always on</p>
    <p className="spoken-caption" data-caption-index={state.index}>{state.caption || frames[0]?.text}</p>
    {current && current.refs.length > 0 && sources(current.refs)}
    <audio ref={audio} preload="none" data-narration-audio aria-hidden="true"/>
    <div className="activity-actions">
      {!state.enabled && <button className="primary" onClick={() => engine.current?.play()}>Enable narration</button>}
      <button onClick={() => engine.current?.play()}>Play audio</button>
      <button disabled={!['playing', 'waiting'].includes(state.status)} onClick={() => engine.current?.pause()}>Pause audio</button>
      <button onClick={() => engine.current?.replay()}>Replay audio</button>
      {state.enabled && <button onClick={() => engine.current?.disable()}>Turn narration off</button>}
    </div>
    <label htmlFor="narration-speed">Speech speed</label>
    <select id="narration-speed" value={state.rate} onChange={event => engine.current?.setRate(Number(event.target.value))}>
      {[0.75, 1, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
    </select>
    <p className="narration-status" role="status" data-status={state.status} data-backend={state.backend}>{state.message}</p>
  </section>;
});
