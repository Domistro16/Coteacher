import { useEffect, useRef, useState } from 'react';
import { createNarration, initialNarrationState, type Narration, type NarrationFrame } from './narration';
import { preparedClip } from './Narrator';

/** Actual bundled media only. Never substitute a cloud/device voice for missing clips. */
export function useCompanionSpeech() {
  const audio = useRef<HTMLAudioElement>(null);
  const engine = useRef<Narration | null>(null);
  const frames = useRef<readonly NarrationFrame[]>([]);
  const remote = useRef<{ text: string; url: string } | null>(null);
  const [state, setState] = useState(initialNarrationState);
  const [speaking, setSpeaking] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [visualTimeMs, setVisualTimeMs] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;
  useEffect(() => {
    engine.current = createNarration({ audio: audio.current!, clip: text => remote.current?.text === text ? remote.current.url : preparedClip(text),
      utterance: () => { throw new Error('Companion speech uses prepared clips only.'); } }, next => {
        const previous = stateRef.current;
        // Leave the complete approved scene visible while asking for a response.
        if ((next.index > previous.index && (frames.current[previous.index]?.refs.length || remote.current?.text === previous.caption) && !frames.current[next.index]?.refs.length)
          || (next.status === 'complete' && (frames.current[next.index]?.refs.length || remote.current?.text === next.caption))) setVisualTimeMs(4500);
        stateRef.current = next; setState(next);
      });
    const stop = () => { engine.current?.disable(); setSpeaking(false); };
    const hidden = () => { if (document.hidden) { engine.current?.pause(); setSpeaking(false); } };
    window.addEventListener('coteacher-lock', stop); window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => { engine.current?.dispose(); engine.current = null; if (remote.current) URL.revokeObjectURL(remote.current.url); remote.current = null; window.removeEventListener('coteacher-lock', stop);
      window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!speaking) return;
    let frame = 0, last = 0;
    const tick = (now: number) => {
      if (now - last >= 100 && audio.current && !audio.current.paused) {
        const time = audio.current.currentTime * 1000;
        setTimeMs(time);
        if (frames.current[stateRef.current.index]?.refs.length || remote.current?.text === stateRef.current.caption) setVisualTimeMs(time);
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [speaking]);
  function clearGenerated() {
    if (remote.current) { engine.current?.disable(); URL.revokeObjectURL(remote.current.url); remote.current = null; }
  }
  return { audio, state, speaking, timeMs, visualTimeMs, generated: Boolean(remote.current && frames.current[0]?.text === remote.current.text), refs: frames.current[state.index]?.refs ?? [],
    speakGenerated(text: string, base64: string) {
      window.dispatchEvent(new Event('coteacher-pause-recording'));
      engine.current?.disable(); if (remote.current) URL.revokeObjectURL(remote.current.url);
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      remote.current = { text, url: URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })) };
      frames.current = [{ text, refs: [] }]; setTimeMs(0); setVisualTimeMs(0);
      engine.current?.load(frames.current.map(frame => frame.text)); engine.current?.play();
    },
    prepare(next: readonly NarrationFrame[]) { clearGenerated(); frames.current = next; engine.current?.load(next.map(frame => frame.text)); },
    speak(next: readonly NarrationFrame[]) {
      clearGenerated();
      window.dispatchEvent(new Event('coteacher-pause-recording'));
      frames.current = next; setTimeMs(0); if (next.some(frame => frame.refs.length)) setVisualTimeMs(0);
      engine.current?.load(next.map(frame => frame.text)); engine.current?.play();
    },
    pause: () => { engine.current?.pause(); setSpeaking(false); },
    stop: () => { engine.current?.disable(); setSpeaking(false); },
    replay: () => { window.dispatchEvent(new Event('coteacher-pause-recording')); engine.current?.replay(); },
    play: () => { window.dispatchEvent(new Event('coteacher-pause-recording')); engine.current?.play(); },
    mediaEvents: { onPlaying: () => { if (audio.current && !audio.current.paused) setSpeaking(true); }, onPause: () => setSpeaking(false), onWaiting: () => setSpeaking(false), onEnded: () => setSpeaking(false), onError: () => setSpeaking(false) },
  };
}
