import { useEffect, useRef, useState } from 'react';
import { projectorChannelName, type ProjectorFrame } from './projector-channel';

export function useProjector(frame: ProjectorFrame | null) {
  // A saved classroom session lets an open display reconnect after studio reload.
  const session = frame?.sessionId ?? 'not-started';
  const latest = useRef(frame); latest.current = frame;
  const channel = useRef<BroadcastChannel | null>(null);
  const display = useRef<Window | null>(null);
  const [status, setStatus] = useState('Projector not opened');
  const [error, setError] = useState('');
  const lastReply = useRef(0);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const connection = new BroadcastChannel(projectorChannelName(session)); channel.current = connection;
    const send = () => connection.postMessage({ kind: 'frame', frame: latest.current });
    connection.onmessage = event => {
      if (event.data?.kind === 'hello') send();
      if (event.data?.kind === 'display-closed') { lastReply.current = 0; setStatus('Projector closed · reopen anytime'); }
      if (event.data?.kind === 'connected') { lastReply.current = Date.now(); setStatus('Projector connected'); }
    };
    const timer = window.setInterval(() => {
      if (display.current?.closed) { display.current = null; lastReply.current = 0; setStatus('Projector closed · reopen anytime'); }
      else if (lastReply.current && Date.now() - lastReply.current > 5000) setStatus('Projector not responding · reopen anytime');
      connection.postMessage({ kind: 'heartbeat' });
    }, 1000);
    const ended = () => connection.postMessage({ kind: 'ended' });
    window.addEventListener('pagehide', ended);
    return () => {
      ended(); window.removeEventListener('pagehide', ended); clearInterval(timer);
      connection.close(); channel.current = null;
    };
  }, [session]);
  useEffect(() => { channel.current?.postMessage({ kind: 'frame', frame }); }, [frame?.stepId, frame?.sessionId, frame?.title]);
  useEffect(() => { if (frame) channel.current?.postMessage({ kind: 'clock', motion: frame.motion }); }, [frame?.motion.elapsedMs, frame?.motion.running, frame?.motion.stepId]);
  function open() {
    setError('');
    if (!frame) return;
    if (typeof BroadcastChannel === 'undefined') { setError('This browser cannot link a second display. Use Focus studio on this screen.'); return; }
    const url = new URL(location.href); url.search = ''; url.hash = '';
    url.searchParams.set('projector', session);
    // A user-activated same-origin window. It only mounts the visual renderer.
    const opened = window.open(url.href, `coteacher-projector-${session}`, 'popup,width=1280,height=720');
    if (!opened) { setError('The projector window was blocked. Allow pop-ups for Coteacher, or use Focus studio.'); return; }
    display.current = opened; lastReply.current = Date.now(); setStatus('Connecting projector…');
  }
  return { open, status, error, dismissError: () => setError('') };
}
