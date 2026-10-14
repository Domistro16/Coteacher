export interface NarrationFrame { text: string; refs: readonly string[] }
export interface NarrationState {
  caption: string; index: number; total: number; enabled: boolean; rate: number;
  status: 'off' | 'ready' | 'playing' | 'paused' | 'waiting' | 'complete' | 'unavailable';
  backend: 'clip' | 'synthesis' | null; message: string;
}
export interface NarrationPorts {
  audio: HTMLAudioElement;
  synthesis?: SpeechSynthesis;
  utterance: (text: string) => SpeechSynthesisUtterance;
  clip: (text: string) => string | undefined;
}
export interface Narration {
  load(captions: readonly string[]): void;
  play(): void; pause(): void; replay(): void; disable(): void;
  setRate(rate: number): void; dispose(): void;
}

export const initialNarrationState: NarrationState = {
  caption: '', index: 0, total: 0, enabled: false, rate: 1, status: 'off', backend: null,
  message: 'Enable narration to hear the lesson. Captions stay visible.',
};

/** One speaker; captions survive failures. Only explicitly local synthesis voices. */
export function createNarration(ports: NarrationPorts, onState: (state: NarrationState) => void): Narration {
  let state = { ...initialNarrationState };
  let captions: string[] = [];
  let generation = 0;
  let disposed = false;
  let waitingTimer: ReturnType<typeof setTimeout> | undefined;
  let voicesChanged: (() => void) | undefined;
  function publish(patch: Partial<NarrationState>) {
    if (disposed) return;
    state = { ...state, ...patch }; onState(state);
  }
  function clearVoiceWait() {
    if (waitingTimer) clearTimeout(waitingTimer);
    if (voicesChanged) ports.synthesis?.removeEventListener('voiceschanged', voicesChanged);
    waitingTimer = undefined; voicesChanged = undefined;
  }
  function stop() {
    generation++; clearVoiceWait();
    ports.audio.onended = null; ports.audio.onerror = null;
    ports.audio.pause();
    ports.synthesis?.cancel();
  }
  function ended(token: number) {
    if (token !== generation || disposed || state.status !== 'playing') return;
    if (state.index + 1 < captions.length) {
      publish({ index: state.index + 1, caption: captions[state.index + 1] }); start();
    } else publish({ status: 'complete', message: 'Finished. You can replay this response.' });
  }
  function synthesize(token: number) {
    if (token !== generation || disposed || state.status === 'paused' || (state.backend === 'synthesis' && state.status === 'playing')) return;
    const voice = ports.synthesis?.getVoices().find(v => v.localService && /^en(?:-|$)/i.test(v.lang));
    if (voice) {
      clearVoiceWait();
      const utterance = ports.utterance(state.caption);
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = state.rate;
      utterance.onend = () => ended(token);
      utterance.onerror = () => {
        if (token === generation) publish({ status: 'unavailable', message: 'Speech could not play. Your caption is still here; try Play again.' });
      };
      publish({ status: 'playing', backend: 'synthesis', message: 'Speaking with a local device voice.' });
      ports.synthesis!.speak(utterance);
    } else if (ports.synthesis && !waitingTimer) {
      publish({ status: 'waiting', backend: 'synthesis', message: 'Checking for a local device voice…' });
      voicesChanged = () => synthesize(token);
      ports.synthesis.addEventListener('voiceschanged', voicesChanged);
      waitingTimer = setTimeout(() => {
        clearVoiceWait();
        if (token === generation) publish({ status: 'unavailable', message: 'No offline voice is available for this caption. You can keep reading.' });
      }, 1200);
    } else if (!ports.synthesis) publish({ status: 'unavailable', backend: null, message: 'No offline voice is available for this caption. You can keep reading.' });
  }
  function start() {
    if (disposed || !state.caption) return;
    stop(); const token = generation;
    publish({ backend: null, status: 'ready' });
    const clip = ports.clip(state.caption);
    if (!clip) { synthesize(token); return; }
    ports.audio.src = clip; ports.audio.playbackRate = state.rate;
    ports.audio.onended = () => ended(token);
    ports.audio.onerror = () => { if (token === generation) synthesize(token); };
    publish({ backend: 'clip', status: 'playing', message: 'Playing prepared narration.' });
    void ports.audio.play().catch((error: { name?: string }) => {
      if (token !== generation || disposed) return;
      if (error.name === 'NotAllowedError') publish({ status: 'ready', message: 'Press Play to hear this caption.' });
      else synthesize(token);
    });
  }
  const narrator: Narration = {
    load(next) {
      if (disposed) return;
      stop(); captions = [...next].filter(text => text.trim());
      publish({ caption: captions[0] ?? '', index: 0, total: captions.length, backend: null,
        status: state.enabled ? 'ready' : 'off', message: state.enabled ? 'Ready to play.' : initialNarrationState.message });
      if (state.enabled) start();
    },
    play() {
      if (disposed || !captions.length) return;
      publish({ enabled: true });
      if (state.status === 'paused' && state.backend === 'clip') {
        publish({ status: 'playing', message: 'Playing prepared narration.' });
        const token = generation;
        void ports.audio.play().catch(() => { if (token === generation) publish({ status: 'ready', message: 'Press Play to hear this caption.' }); });
      } else if (state.status === 'paused' && state.backend === 'synthesis') {
        ports.synthesis?.resume(); publish({ status: 'playing', message: 'Speaking with a local device voice.' });
      } else if (state.status !== 'playing') {
        if (state.status === 'complete') publish({ index: 0, caption: captions[0] });
        start();
      }
    },
    pause() {
      if (state.status === 'waiting') { stop(); publish({ status: 'ready', message: 'Paused before speech started.' }); }
      else if (state.status === 'playing') {
        ports.audio.pause(); ports.synthesis?.pause(); publish({ status: 'paused', message: 'Paused. Your caption stays visible.' });
      }
    },
    replay() {
      if (disposed || !captions.length) return;
      publish({ enabled: true, index: 0, caption: captions[0] }); start();
    },
    disable() { stop(); publish({ enabled: false, status: 'off', message: initialNarrationState.message }); },
    setRate(rate) {
      if (!Number.isFinite(rate)) return;
      publish({ rate: Math.min(1.5, Math.max(0.75, rate)) }); ports.audio.playbackRate = state.rate;
      if (state.backend === 'synthesis' && state.status === 'playing') start();
      else if (state.backend === 'synthesis' && state.status === 'paused') {
        stop(); publish({ status: 'ready', message: 'Press Play to speak this caption at the new speed.' });
      }
    },
    dispose() { stop(); disposed = true; },
  };
  return narrator;
}
