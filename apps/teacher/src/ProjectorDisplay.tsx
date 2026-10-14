import { useEffect, useRef, useState } from 'react';
import { TeachingCanvas } from './TeachingCanvas';
import { isPresentationMotion, isProjectorFrame, projectorChannelName, type PresentationMotion, type ProjectorFrame } from './projector-channel';

export function ProjectorDisplay({ session }: { session: string }) {
  const [frame, setFrame] = useState<ProjectorFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const surface = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(projectorChannelName(session));
    let lastMessage = 0;
    let lastClockReply = 0;
    const hello = () => channel.postMessage({ kind: 'hello' });
    const closing = () => channel.postMessage({ kind: 'display-closed' });
    window.addEventListener('pagehide', closing);
    channel.onmessage = event => {
      if (event.data?.kind === 'ended') { setConnected(false); lastMessage = 0; return; }
      if (event.data?.kind === 'heartbeat') {
        lastMessage = Date.now(); setConnected(true); channel.postMessage({ kind: 'connected' });
      }
      if (event.data?.kind === 'frame' && isProjectorFrame(event.data.frame)) {
        setFrame(event.data.frame); setConnected(true); lastMessage = Date.now();
        channel.postMessage({ kind: 'connected' });
      }
      if (event.data?.kind === 'clock' && isPresentationMotion(event.data.motion)) {
        const motion: PresentationMotion = event.data.motion;
        lastMessage = Date.now(); setConnected(true);
        if (lastMessage - lastClockReply >= 1000) { channel.postMessage({ kind: 'connected' }); lastClockReply = lastMessage; }
        setFrame(previous => previous && previous.stepId === motion.stepId ? { ...previous, motion } : previous);
      }
    };
    hello();
    const timer = window.setInterval(() => {
      if (Date.now() - lastMessage > 4000) { setConnected(false); hello(); }
      // Ask for the latest visual after reload or a late/missed connection.
      if (!lastMessage) hello();
    }, 1000);
    return () => { window.removeEventListener('pagehide', closing); clearInterval(timer); channel.close(); };
  }, [session]);
  async function fullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (surface.current?.requestFullscreen) await surface.current.requestFullscreen();
      else setFullscreenError('Fullscreen is unavailable. Maximize this window instead.');
    } catch { setFullscreenError('Fullscreen was blocked. Maximize this window instead.'); }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement) { event.preventDefault(); void document.exitFullscreen().catch(() => {}); }
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); void fullscreen(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  return <main ref={surface} className="classroom-projector" tabIndex={0} aria-label="Classroom projector"
    onDoubleClick={() => void fullscreen()} data-connected={connected}
    data-presentation-step-id={frame?.stepId} data-presentation-concept-id={frame?.conceptId}>
    {frame ? <TeachingCanvas frame={frame}/> : <p className="projector-waiting">Waiting for your teacher’s lesson…</p>}
    {frame && !connected && <p className="projector-waiting" role="status">Waiting for your teacher to reconnect…</p>}
    {fullscreenError && <p className="projector-waiting" role="alert">{fullscreenError}</p>}
  </main>;
}
