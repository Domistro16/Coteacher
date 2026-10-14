import { useEffect, useRef, useState } from 'react';

/** Deliberate, bounded recording of the learner's question, never continuous classroom listening. */
export function useConnectedVoice(transcribe: (blob: Blob) => Promise<string>, onText: (text: string) => void) {
  const [status, setStatus] = useState('Microphone off');
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | undefined>(undefined), generation = useRef(0);
  const acquiring = useRef(false);
  const latest = useRef({ transcribe, onText }); latest.current = { transcribe, onText };
  function cancel() {
    generation.current++; clearTimeout(timer.current);
    acquiring.current = false;
    if (recorder.current?.state !== 'inactive') recorder.current?.stop();
    recorder.current = null; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    setRecording(false); setStatus('Microphone off');
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('coteacher-lock', cancel); window.addEventListener('pagehide', cancel); document.addEventListener('visibilitychange', hidden);
    return () => { cancel(); window.removeEventListener('coteacher-lock', cancel); window.removeEventListener('pagehide', cancel); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  return { status, recording, cancel,
    stop() { clearTimeout(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); },
    async start() {
      if (recorder.current || acquiring.current) return;
      acquiring.current = true;
      const token = ++generation.current;
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Voice recording is unsupported. Please type.');
        setStatus('Requesting microphone permission…');
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (token !== generation.current) { mic.getTracks().forEach(track => track.stop()); return; }
        acquiring.current = false; stream.current = mic;
        const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
        if (!mime) throw new Error('This microphone format is unsupported. Please type.');
        const recording = new MediaRecorder(mic, { mimeType: mime, audioBitsPerSecond: 24000 }); recorder.current = recording;
        const chunks: Blob[] = []; let size = 0;
        recording.ondataavailable = event => { size += event.data.size; chunks.push(event.data); if (size > 1000000 && recording.state === 'recording') recording.stop(); };
        recording.onerror = () => { cancel(); setStatus('Microphone recording failed. Please type your question.'); };
        recording.onstop = () => {
          clearTimeout(timer.current); mic.getTracks().forEach(track => track.stop()); stream.current = null; recorder.current = null;
          if (token !== generation.current) return;
          setRecording(false); setStatus('Microphone off · sending this question to OpenAI for transcription…');
          const blob = new Blob(chunks, { type: mime });
          if (!blob.size || blob.size > 1000000) { setStatus('No usable voice question. Please type.'); return; }
          void latest.current.transcribe(blob).then(text => {
            if (token !== generation.current) return;
            latest.current.onText(text); setStatus('Microphone off · check the text, then send your question.');
          }).catch(error => { if (token === generation.current) setStatus((error as Error).message); });
        };
        recording.start(1000); setRecording(true); setStatus('Microphone on · listening to your question (up to 20 seconds)');
        timer.current = window.setTimeout(() => { if (recording.state === 'recording') recording.stop(); }, 20000);
      } catch (error) { if (token === generation.current) { cancel(); setStatus((error as Error).message); } }
    }
  };
}
