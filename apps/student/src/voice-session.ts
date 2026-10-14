export interface VoiceSessionState {
  status: 'off' | 'checking' | 'listening' | 'unavailable'; message: string;
}
interface Recognition {
  processLocally: boolean; lang: string; continuous: boolean; interimResults: boolean;
  start(): void; abort(): void;
  onresult: ((event: { resultIndex?: number; results: { length?: number; [n: number]: { isFinal?: boolean; [n: number]: { transcript: string; confidence: number } } } }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; onstart: (() => void) | null;
}
type Constructor = { new(): Recognition; available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string> };

/** Opt-in local recognition only. No webkit/cloud fallback, audio storage or hidden install. */
export function createVoiceSession() {
  let active: Recognition | null = null, generation = 0;
  let restart: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    generation++; clearTimeout(restart); restart = undefined;
    const previous = active; active = null;
    if (previous) { previous.onresult = null; previous.onerror = null; previous.onend = null; previous.onstart = null; try { previous.abort(); } catch { /* already ended */ } }
  }
  return {
    stop() { cancel(); },
    async start(onText: (text: string) => void, onState: (state: VoiceSessionState) => void) {
      cancel(); const token = generation;
      onState({ status: 'checking', message: 'Checking local voice access…' });
      const Constructor = (window as unknown as { SpeechRecognition?: Constructor }).SpeechRecognition;
      const unavailable = (message = 'Offline voice is unavailable on this device. Please type your question.') => {
        if (token !== generation) return;
        cancel(); onState({ status: 'unavailable', message });
      };
      if (!Constructor?.available) { unavailable(); return; }
      try {
        const available = await Constructor.available({ langs: ['en-US'], processLocally: true });
        if (token !== generation) return;
        if (available !== 'available') { unavailable(); return; }
        let emptyEnds = 0;
        const listen = () => {
          if (token !== generation) return;
          const recognition = new Constructor();
          if (!('processLocally' in recognition)) { unavailable(); return; }
          recognition.processLocally = true; recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = false;
          let received = false;
          recognition.onresult = event => {
            if (token !== generation || active !== recognition) return;
            for (let i = event.resultIndex ?? 0; i < (event.results.length ?? 1); i++) {
              const result = event.results[i];
              if (!result || result.isFinal === false) continue;
              const candidate = result[0];
              if (!candidate?.transcript.trim()) continue;
              received = true; emptyEnds = 0;
              if (candidate.confidence >= .7 && candidate.transcript.length <= 1500) onText(candidate.transcript);
              else onState({ status: 'listening', message: 'I could not hear clearly. Please type your question.' });
              if (token !== generation) return;
            }
          };
          recognition.onerror = event => {
            if (active !== recognition || token !== generation) return;
            unavailable(event.error === 'not-allowed' || event.error === 'service-not-allowed'
              ? 'Microphone permission was not granted. Tap or type to get help.' : 'Voice stopped. Tap Voice mode to try again, or type your question.');
          };
          recognition.onend = () => {
            if (token !== generation || active !== recognition) return;
            active = null;
            if (!received && ++emptyEnds >= 3) { unavailable('Voice stopped after silence. Tap Voice mode to try again, or type.'); return; }
            restart = setTimeout(() => { try { listen(); } catch { unavailable('Voice could not restart. Please type your question.'); } }, 250);
          };
          recognition.onstart = () => { if (token === generation && active === recognition) onState({ status: 'listening', message: 'Microphone on · listening locally' }); };
          active = recognition;
          onState({ status: 'checking', message: 'Starting local voice · allow microphone access if asked' });
          recognition.start();
        };
        listen();
      } catch { unavailable('Voice was unavailable. Please type your question.'); }
    },
  };
}
