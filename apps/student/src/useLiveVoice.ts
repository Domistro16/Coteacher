import { useEffect, useRef, useState } from 'react';
import { createLiveVoice, type LiveVoiceState, type LiveVoiceOptions } from './live-voice';

export function useLiveVoice(scope: string, permitted: boolean) {
  const audio = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createLiveVoice> | null>(null);
  const [state, setState] = useState<LiveVoiceState>({ status: 'off', message: 'Live microphone off · text works too', caption: '', speaking: false, timeMs: 0 });
  useEffect(() => {
    const stop = () => controller.current?.stop();
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener('offline', stop); window.addEventListener('coteacher-lock', stop);
    window.addEventListener('pagehide', stop); window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hide);
    return () => { stop(); window.removeEventListener('offline', stop); window.removeEventListener('coteacher-lock', stop);
      window.removeEventListener('pagehide', stop); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hide); };
  }, [scope]);
  useEffect(() => { if (!permitted) controller.current?.stop(); }, [permitted]);
  return { audio, state, active: !['off', 'error'].includes(state.status),
    isActive: () => controller.current?.active ?? false,
    stop: () => controller.current?.stop(),
    play: () => controller.current?.play(),
    ask: async (text: string) => { await controller.current?.ask(text); },
    async start(options: Omit<LiveVoiceOptions, 'state'>) {
      if (!permitted || !audio.current) return;
      controller.current ??= createLiveVoice(audio.current);
      await controller.current.start({ ...options, state: setState });
    }
  };
}
