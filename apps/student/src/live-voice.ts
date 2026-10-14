export interface LiveVoiceState {
  status: 'off' | 'connecting' | 'listening' | 'working' | 'closing' | 'error';
  message: string; caption: string; speaking: boolean; timeMs: number;
}
export interface LiveVoiceOptions {
  connect: (sdp: string, signal: AbortSignal, progress?: (message: string) => void) => Promise<{ session: { id: string }; transport: { sdp: string }; model?: string }>;
  delegate: (text: string, signal: AbortSignal) => Promise<{ text: string; sourceRefs: string[] }>;
  transcript: (sessionId: string, role: 'student' | 'avatar', text: string, sourceRefs: string[], model: string) => void;
  state: (value: LiveVoiceState) => void;
}
const initial: LiveVoiceState = { status: 'off', message: 'Live microphone off · prepared help and text work too', caption: '', speaking: false, timeMs: 0 };

/** Online WebRTC only. Never invokes recognition, TTS or a second teacher recorder. */
export function createLiveVoice(audio: HTMLAudioElement) {
  let state = { ...initial }, peer: RTCPeerConnection | undefined, channel: RTCDataChannel | undefined;
  let mic: MediaStream | undefined, options: LiveVoiceOptions | undefined, abort: AbortController | undefined;
  let generation = 0, sessionId = '', closeTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  const delegateTimers = new Set<ReturnType<typeof setTimeout>>();
  let transcriptTimer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0, meterTimer: ReturnType<typeof setTimeout> | undefined;
  let input: { delta: string; endMs?: number }[] = [], output = '', sources: string[] = [], latestDelegation = '', model = 'gpt-live-1';
  let outputAllowed = true, progressOnly = false;
  const progressWords = new Set("hmm hm okay ok sure one moment i'm i am will i'll let me checking check looking look at into on that this it your the our lesson sources source notes a quick just second now for you against from".split(' '));
  function allowProgress(text: string) {
    const words = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?]/g, ' ').trim().split(/\s+/);
    return words.length <= 24 && words.some(word => ['checking', 'check', 'looking', 'look'].includes(word)) && words.every(word => progressWords.has(word));
  }
  const delegated = new Set<string>();
  const emit = (patch: Partial<LiveVoiceState>) => { state = { ...state, ...patch }; options?.state(state); };
  function flushOutput() {
    clearTimeout(transcriptTimer);
    if (sessionId && output.trim()) options?.transcript(sessionId, 'avatar', output.slice(0, 4000), [...sources], model);
    output = '';
  }
  function announceChecking(id: string | null, task: string, token: number) {
    const timer = setTimeout(() => {
      delegateTimers.delete(timer);
      if (token !== generation || task !== latestDelegation || channel?.readyState !== 'open') return;
      flushOutput(); progressOnly = true;
      channel.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: id, content: 'Hmm, checking your lesson sources.' }));
    }, 500);
    delegateTimers.add(timer);
    return () => { clearTimeout(timer); delegateTimers.delete(timer); };
  }
  function release() {
    clearTimeout(closeTimer); clearTimeout(connectTimer); for (const timer of delegateTimers) clearTimeout(timer); delegateTimers.clear(); clearTimeout(transcriptTimer);
    cancelAnimationFrame(frame); mic?.getTracks().forEach(track => track.stop()); mic = undefined;
    channel?.close(); channel = undefined; peer?.close(); peer = undefined;
    clearTimeout(meterTimer); audio.pause(); audio.srcObject = null;
  }
  function fail(message: string) {
    ++generation; abort?.abort(); flushOutput(); release(); emit({ status: 'error', message, speaking: false });
  }
  function stop() {
    if (!peer || state.status === 'closing') return;
    ++generation; abort?.abort(); flushOutput();
    // Permission and output stop immediately; keep the event channel briefly for final usage.
    mic?.getTracks().forEach(track => track.stop()); audio.pause(); audio.muted = true;
    clearTimeout(connectTimer); clearTimeout(meterTimer); for (const timer of delegateTimers) clearTimeout(timer); delegateTimers.clear(); cancelAnimationFrame(frame);
    if (channel?.readyState === 'open') {
      emit({ status: 'closing', message: 'Microphone off · ending live conversation…', speaking: false });
      channel.send(JSON.stringify({ type: 'session.close' }));
      closeTimer = setTimeout(() => { release(); emit({ status: 'off', message: 'Microphone off. Connection closed; final voice usage was not confirmed.', speaking: false }); }, 5000);
    } else { release(); emit({ ...initial }); }
  }
  async function handle(event: Record<string, unknown>, token: number) {
    if (event.type === 'session.closed' && (token === generation || state.status === 'closing' && token + 1 === generation)) {
      flushOutput(); release(); emit({ status: 'off', message: 'Live conversation ended · microphone off', speaking: false }); return;
    }
    if (token !== generation) return;
    if (event.type === 'session.started') {
      clearTimeout(connectTimer); emit({ status: 'listening', message: 'Live microphone on · talking with Coteacher (connected)' });
      // Start receiver statistics after negotiation, not inside the synchronous track event.
      if (peer && typeof peer.getStats === 'function') meter(peer, token);
      channel?.send(JSON.stringify({ type: 'session.instructions.append', delegation_id: null,
        content: 'Give the short listening greeting supplied next, then wait for the student. Delegate the learner\'s teaching questions; do not start an explanation or invent a question before they ask.' }));
      channel?.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: null,
        content: "The teacher's recording is paused. So, what's the problem? Tell me which part you're struggling with. I'm listening." }));
    } else if (event.type === 'session.input_transcript.delta' && typeof event.delta === 'string') {
      flushOutput(); input.push({ delta: event.delta, endMs: typeof event.end_ms === 'number' ? event.end_ms : undefined });
      // The voice model cannot deliver a fresh teaching answer before the checked backend result.
      outputAllowed = false; progressOnly = false; audio.muted = true; sources = [];
      const text = input.map(item => item.delta).join('');
      if (text.length > 1500) { input = []; channel?.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: null, content: 'Please ask one shorter question, or type it. The current question was too long to save safely.' })); }
      emit({ caption: text.slice(0, 1500), speaking: false });
    } else if (event.type === 'session.output_transcript.delta' && typeof event.delta === 'string') {
      output += event.delta;
      if (progressOnly && !outputAllowed) {
        const allowed = allowProgress(output);
        audio.muted = !allowed;
        if (allowed) emit({ caption: output.slice(-2000) });
      }
      if (outputAllowed) emit({ caption: output.slice(-2000) });
      clearTimeout(transcriptTimer); transcriptTimer = setTimeout(flushOutput, 1500);
      if (output.length > 3500) flushOutput();
    } else if (event.type === 'session.delegation.created') {
      const metadata = event.delegation as { id?: unknown; target?: unknown } | undefined;
      if (metadata?.target !== 'client' || typeof metadata.id !== 'string' || delegated.has(metadata.id)) return;
      const id = metadata.id; delegated.add(id); latestDelegation = id;
      // Delegations contain metadata, NOT the question. Allow transcript events to catch up.
      const cutoff = typeof event.offset_ms === 'number' ? event.offset_ms : undefined;
      const timer = setTimeout(async () => {
        delegateTimers.delete(timer);
        if (token !== generation || channel?.readyState !== 'open') return;
        const fragments = input.filter(item => cutoff === undefined || item.endMs === undefined || item.endMs <= cutoff + 800);
        const consumed = new Set(fragments); input = input.filter(item => !consumed.has(item));
        const text = fragments.map(item => item.delta).join('').trim();
        if (!text) { channel.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: id, content: 'I did not receive a usable question transcript. Please repeat it or type it; I will not guess.' })); return; }
        options?.transcript(sessionId, 'student', text, [], model);
        emit({ status: 'working', message: 'Microphone on · checking your lesson sources…', caption: text });
        const cancelChecking = announceChecking(id, id, token);
        try {
          const result = await options!.delegate(text, abort!.signal);
          if (token !== generation || id !== latestDelegation || channel?.readyState !== 'open') return;
          flushOutput(); sources = result.sourceRefs;
          progressOnly = false; outputAllowed = true; audio.muted = false;
          channel.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: id, content: result.text.slice(0, 1800) }));
          emit({ status: 'listening', message: 'Live microphone on · ask a follow-up or try the concept check' });
        } catch (error) {
          if (token !== generation || channel?.readyState !== 'open') return;
          channel.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: id, content: 'I cannot retrieve a reliable answer now. Your saved question remains queued. Use prepared help or type another question.' }));
          emit({ status: 'listening', message: (error as Error).message + ' Your question remains saved.' });
        } finally { cancelChecking(); }
      }, 600);
      delegateTimers.add(timer);
    } else if (event.type === 'error' || event.type === 'session.error') {
      const detail = event.error as { message?: unknown; code?: unknown } | undefined;
      fail('Live voice error: ' + (typeof detail?.message === 'string' ? detail.message.slice(0, 500) : 'The session rejected a request.') + (typeof detail?.code === 'string' ? ` (${detail.code})` : '') + ' Your question and lesson position are saved.');
    }
  }
  function meter(connection: RTCPeerConnection, token: number) {
    let energy = 0, duration = 0, audible = false, last = 0;
    async function sample() {
      if (token !== generation) return;
      try {
        const stats = await connection.getStats(); let nextEnergy = 0, nextDuration = 0;
        stats.forEach(stat => { if (stat.type === 'inbound-rtp' && (stat.kind === 'audio' || stat.mediaType === 'audio' || typeof stat.totalAudioEnergy === 'number')) { nextEnergy += stat.totalAudioEnergy ?? 0; nextDuration += stat.totalSamplesDuration ?? 0; } });
        audible = nextDuration > duration && Math.sqrt(Math.max(0, nextEnergy - energy) / (nextDuration - duration)) > .008;
        energy = nextEnergy; duration = nextDuration;
      } catch { audible = false; }
      if (token === generation) meterTimer = setTimeout(() => void sample(), 250);
    }
    // Receiver energy describes actual decoded speech. The native playhead drives motion;
    // no Web Audio graph intercepts or duplicates the voice output.
    const tick = (time: number) => {
      if (token !== generation) return;
      if (time - last > 75) { last = time; emit({ speaking: !audio.paused && !audio.muted && audible, timeMs: audio.currentTime * 1000 }); }
      frame = requestAnimationFrame(tick);
    }; void sample(); frame = requestAnimationFrame(tick);
  }
  return {
    get active() { return Boolean(peer); },
    stop,
    async ask(text: string) {
      if (!text.trim() || text.length > 1500) return;
      if (!peer || channel?.readyState !== 'open' || !sessionId || !options || !abort) {
        emit({ message: 'Live voice is not ready. Wait for connection or turn voice off to ask by text.' }); return;
      }
      const token = generation;
      const taskId = 'typed-' + crypto.randomUUID(); latestDelegation = taskId;
      input = [];
      flushOutput(); outputAllowed = false; progressOnly = false; audio.muted = true; sources = [];
      options.transcript(sessionId, 'student', text, [], model);
      emit({ status: 'working', caption: text, message: 'Checking your typed question against lesson sources…' });
      // Typed questions are application context, not invented microphone transcripts.
      channel.send(JSON.stringify({ type: 'session.thinking.append', delegation_id: null, content: JSON.stringify({ learnerTypedQuestion: text }).slice(0, 1800) }));
      const cancelChecking = announceChecking(null, taskId, token);
      try {
        const result = await options.delegate(text, abort.signal);
        if (token !== generation || latestDelegation !== taskId || channel?.readyState !== 'open') return;
        flushOutput(); sources = result.sourceRefs; progressOnly = false; outputAllowed = true; audio.muted = false;
        channel.send(JSON.stringify({ type: 'session.commentary.append', delegation_id: null, content: result.text.slice(0, 1800) }));
        emit({ status: 'listening', message: 'Live microphone on · ask a follow-up or try the concept check' });
      } catch (error) {
        if (token === generation) emit({ status: 'listening', message: (error as Error).message + ' Your question remains saved.' });
      } finally { cancelChecking(); }
    },
    play() {
      if (!peer || state.status === 'closing') return;
      if (!outputAllowed) { emit({ message: 'Checking your lesson sources · live speech will return when the answer is ready' }); return; }
      audio.muted = false;
      void audio.play().catch(() => emit({ message: 'Live sound could not play. Read the sourced answer or use prepared help.', speaking: false }));
    },
    async start(next: LiveVoiceOptions) {
      if (peer) return;
      options = next; const token = ++generation; abort = new AbortController();
      input = []; output = ''; sources = []; latestDelegation = ''; sessionId = ''; outputAllowed = true; progressOnly = false; delegated.clear();
      emit({ ...initial, status: 'connecting', message: 'Requesting microphone access and connecting live voice…' });
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') { fail('Live voice is unavailable in this browser. Please use text.'); return; }
      try {
        const connection = new RTCPeerConnection(); peer = connection;
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (token !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
        mic = acquired;
        emit({ message: 'Microphone on · preparing the voice connection…' });
        for (const track of mic.getAudioTracks()) connection.addTrack(track, mic);
        audio.autoplay = true; audio.muted = false;
        connection.addEventListener('track', event => {
          if (token !== generation || event.track.kind !== 'audio') return;
          const stream = new MediaStream([event.track]); audio.srcObject = stream;
          void audio.play().catch(() => emit({ message: 'Microphone on · tap Play live voice to hear Coteacher' }));
        });
        channel = connection.createDataChannel('oai-events');
        channel.addEventListener('message', event => { try { void handle(JSON.parse(event.data), token); } catch { fail('Unreadable live voice event. Please use text.'); } });
        channel.addEventListener('close', () => { if (token === generation && peer) fail('Live voice disconnected. Saved questions remain queued; please use text.'); });
        connection.addEventListener('connectionstatechange', () => { if (token === generation && ['failed', 'disconnected'].includes(connection.connectionState)) fail('Live voice lost its connection. Your question and lesson position are saved.'); });
        await connection.setLocalDescription(await connection.createOffer());
        if (connection.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { connection.removeEventListener('icegatheringstatechange', changed); reject(new Error('Voice connection timed out. Please type.')); }, 10000);
          function changed() { if (connection.iceGatheringState === 'complete') { clearTimeout(timeout); connection.removeEventListener('icegatheringstatechange', changed); resolve(); } }
          connection.addEventListener('icegatheringstatechange', changed); changed();
        });
        if (token !== generation) return;
        const sdp = connection.localDescription?.sdp;
        if (!sdp) throw new Error('No microphone connection offer. Please type.');
        emit({ message: 'Microphone on · checking your saved lesson connection…' });
        const result = await next.connect(sdp, abort.signal, message => { if (token === generation) emit({ message }); });
        if (token !== generation) return;
        sessionId = result.session.id; model = result.model ?? 'gpt-live-1';
        emit({ message: 'Microphone on · waiting for live audio to start…' });
        connectTimer = setTimeout(() => fail('Live voice did not start. Your lesson is preserved; please use text.'), 20000);
        await connection.setRemoteDescription({ type: 'answer', sdp: result.transport.sdp });
      } catch (error) { if (token === generation) fail((error as Error).name === 'NotAllowedError' ? 'Microphone permission was denied. Please type your question or use prepared help.' : (error as Error).message); }
    }
  };
}
