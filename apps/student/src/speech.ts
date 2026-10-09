export interface SpeechInput {
  start(onText: (text: string) => void, onStatus: (status: string) => void): Promise<void>;
  stop(): void;
}
interface Recognition {
  processLocally: boolean; lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: { [n: number]: { [n: number]: { transcript: string; confidence: number } } } }) => void) | null;
  onerror: (() => void) | null;
}
type Constructor = { new(): Recognition; available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string> };
export function createSpeechInput(): SpeechInput {
  let active: Recognition | null = null; let held = false; let requestId = 0;
  return {
    async start(onText, onStatus) {
      held = true;
      const request = ++requestId;
      const Constructor = (window as unknown as { SpeechRecognition?: Constructor }).SpeechRecognition;
      if (!Constructor?.available) { onStatus('Offline voice is unavailable on this device. Please type your question.'); return; }
      try {
        const availability = await Constructor.available({ langs: ['en-US'], processLocally: true });
        if (!held || request !== requestId) return;
        if (availability !== 'available') {
          onStatus('Offline voice is unavailable on this device. Please type your question.'); return;
        }
        const recognition = new Constructor();
        if (!('processLocally' in recognition)) { onStatus('Please type your question.'); return; }
        recognition.processLocally = true; recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false;
        recognition.onresult = event => {
          const result = event.results[0][0];
          if (result.confidence >= 0.7) { onText(result.transcript); onStatus('Check the transcript before sending.'); }
          else onStatus('I could not hear clearly. Please type your question.');
        };
        recognition.onerror = () => onStatus('Voice was unavailable. Please type your question.');
        active = recognition; recognition.start(); onStatus('Listening while you hold the button…');
      } catch { active = null; onStatus('Voice was unavailable. Please type your question.'); }
    },
    stop() { held = false; requestId++; const recognition = active; active = null; try { recognition?.stop(); } catch { /* Already stopped by the device. */ } },
  };
}
