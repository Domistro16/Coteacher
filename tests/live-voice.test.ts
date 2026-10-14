import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decryptPayload, emptyProgress, encryptPayload, type TutorState } from '@coteacher/shared';
import { LessonDeliveryStore } from '../delivery/store';
import { ProgressReturnStore } from '../delivery/progress-store';
import { TutorStore } from '../delivery/tutor-store';
import { OpenAILiveVoice, type LiveVoiceProvider } from '../delivery/live-provider';
import { createLiveVoice, type LiveVoiceState } from '../apps/student/src/live-voice';
import { MockTutor, tutorPackages } from './tutor-fixture';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('GPT-Live client delegation and privacy boundaries (mock transport)', () => {
  it('keeps credentials/configuration on the server and selects client delegation, independently of the reasoning model', async () => {
    const call = vi.fn(async () => new Response(JSON.stringify({ session: { id: 'live_opaque' }, transport: { type: 'webrtc', sdp: 'answer' } }), { status: 201 }));
    const live = new OpenAILiveVoice('test-key', call);
    expect(await live.create('offer', { concept: 'Refraction', objective: 'Explain light bending', classLevel: 'JSS2' })).toEqual({ session: { id: 'live_opaque' }, transport: { type: 'webrtc', sdp: 'answer' } });
    const [url, request] = call.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/live/sessions');
    const payload = JSON.parse(request.body as string);
    expect(payload.session).toMatchObject({ model: 'gpt-live-1', delegation: { type: 'client' } });
    expect(payload.session.instructions).toContain('Delegate ALL educational questions');
    expect(payload.session.instructions).not.toContain('test-key'); expect(payload.transport).toEqual({ type: 'webrtc', sdp: 'offer' });
    await expect(new OpenAILiveVoice('test-key', async () => new Response('{}', { status: 403 })).create('offer', { concept: '', objective: '', classLevel: '' })).rejects.toThrow('403');
  });
  it('requires correct owner, approved recording, consent and bounded configuration; logs survive retries/restart without profile mixing', async () => {
    await mkdir(resolve('.task-tmp'), { recursive: true }); const folder = await mkdtemp(resolve('.task-tmp/live-test-'));
    const packages = tutorPackages(), delivery = new LessonDeliveryStore(folder); await delivery.restore(); await delivery.publish(packages);
    const progress = new ProgressReturnStore(folder, delivery), store = new TutorStore(folder, progress, new MockTutor());
    const a = emptyProgress(packages[0]), b = emptyProgress(packages[1]);
    const voice: LiveVoiceProvider = { model: 'gpt-live-1', create: vi.fn(async () => ({ session: { id: 'live_opaque' }, transport: { type: 'webrtc' as const, sdp: 'answer' } })) };
    const request = { enabled: true, positionMs: 1300, sdp: 'v=0\r\na=valid-test-offer' };
    await progress.receive(a.studentId, 'tutor-recording', await encryptPayload(a, '111111'));
    await expect(store.live(a.studentId, 'tutor-recording', await encryptPayload(request, '111111'), voice)).rejects.toThrow('Enable connected');
    await store.submit(a.studentId, 'tutor-recording', await encryptPayload({ enabled: true, progress: a }, '111111'));
    const connection = await decryptPayload(await store.live(a.studentId, 'tutor-recording', await encryptPayload(request, '111111'), voice), '111111');
    expect(connection).toMatchObject({ session: { id: 'live_opaque' } });
    await expect(store.live(a.studentId, 'tutor-recording', await encryptPayload({ ...request, model: 'untrusted-model' }, '111111'), voice)).rejects.toThrow('Invalid live');
    await expect(store.live(a.studentId, 'tutor-recording', await encryptPayload({ ...request, positionMs: 999999 }, '111111'), voice)).rejects.toThrow('Enable connected');
    await expect(store.live(b.studentId, 'tutor-recording', await encryptPayload(request, '111111'), voice)).rejects.toThrow();
    await expect(store.live(a.studentId, 'tutor-recording', await encryptPayload(request, '111111'))).rejects.toThrow('not configured');
    const turn = { id: 'voice-1', sessionId: 'live_opaque', conceptId: 'refraction', positionMs: 1300, role: 'avatar' as const, text: 'The sourced explanation was spoken.', sourceRefs: [packages[0].sources[0].id], model: 'gpt-live-1', observedAt: new Date().toISOString() };
    for (let retry = 0; retry < 2; retry++) await store.submit(a.studentId, 'tutor-recording', await encryptPayload({ enabled: true, progress: a, liveTurns: [turn] }, '111111'));
    await expect(store.submit(a.studentId, 'tutor-recording', await encryptPayload({ enabled: true, progress: a, liveTurns: [{ ...turn, text: 'Changed transcript' }] }, '111111'))).rejects.toThrow('cannot be rewritten');
    const recovered = new TutorStore(folder, progress, new MockTutor());
    const saved = await decryptPayload(await recovered.returned(a.studentId, 'tutor-recording'), '111111') as TutorState;
    expect(saved.liveTurns).toEqual([turn]);
    await recovered.submit(b.studentId, 'tutor-recording', await encryptPayload({ enabled: true, progress: b }, '222222'));
    expect((await recovered.current(b.studentId, 'tutor-recording')).liveTurns).toBeUndefined();
  }, 120000);
  it('delegates saved transcript text exactly once, returns the checked result with the same ID, and shuts the mic before finalization', async () => {
    vi.useFakeTimers();
    class Channel extends EventTarget {
      readyState = 'open'; sent: Record<string, unknown>[] = [];
      send(value: string) { this.sent.push(JSON.parse(value)); }
      close() { this.readyState = 'closed'; }
      message(value: unknown) { this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(value) })); }
    }
    const channel = new Channel(), stopTrack = vi.fn();
    class Peer extends EventTarget {
      iceGatheringState = 'complete'; connectionState = 'connected'; localDescription = { sdp: 'offer' };
      energy = 0; duration = 0;
      async getStats() { this.energy += .01; this.duration += .25; return new Map([['audio', { type: 'inbound-rtp', mediaType: 'audio', totalAudioEnergy: this.energy, totalSamplesDuration: this.duration }]]); }
      addTrack() {} createDataChannel() { return channel; } async createOffer() { return { type: 'offer', sdp: 'offer' }; }
      async setLocalDescription() {} async setRemoteDescription() {} close() {}
    }
    vi.stubGlobal('RTCPeerConnection', Peer);
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }], getAudioTracks: () => [] })) } });
    const audio = { pause: vi.fn(), play: vi.fn(async () => {}), srcObject: null, muted: false, paused: false, currentTime: 1.25 } as unknown as HTMLAudioElement;
    const delegate = vi.fn(async () => ({ text: 'Checked explanation', sourceRefs: ['notes'] })), transcript = vi.fn();
    let state: LiveVoiceState | undefined;
    const live = createLiveVoice(audio);
    await live.start({ connect: async (_sdp, _signal, progress) => {
      progress?.('Microphone on · waiting for your school connection. Test retry');
      expect(state!.message).toContain('Test retry');
      return { session: { id: 'live_x' }, transport: { sdp: 'answer' } };
    }, delegate, transcript, state: value => { state = value; } });
    expect(state!.message).toBe('Microphone on · waiting for live audio to start…');
    channel.message({ type: 'session.started' });
    expect(delegate).not.toHaveBeenCalled();
    expect(channel.sent).toContainEqual({ type: 'session.commentary.append', delegation_id: null,
      content: "The teacher's recording is paused. So, what's the problem? Tell me which part you're struggling with. I'm listening." });
    await vi.advanceTimersByTimeAsync(100);
    expect(state!.speaking).toBe(true); expect(state!.timeMs).toBe(1250);
    channel.message({ type: 'session.input_transcript.delta', delta: 'Why does ', start_ms: 1, end_ms: 10 });
    expect(audio.muted).toBe(true);
    live.play(); expect(audio.muted).toBe(true);
    channel.message({ type: 'session.input_transcript.delta', delta: 'light bend?', start_ms: 10, end_ms: 30 });
    channel.message({ type: 'session.delegation.created', offset_ms: 40, delegation: { id: 'delegate_1', target: 'client' } });
    channel.message({ type: 'session.delegation.created', offset_ms: 40, delegation: { id: 'delegate_1', target: 'client' } });
    await vi.advanceTimersByTimeAsync(650);
    expect(audio.muted).toBe(false);
    expect(delegate).toHaveBeenCalledTimes(1); expect((delegate.mock.calls[0] as unknown as [string])[0]).toBe('Why does light bend?');
    expect(channel.sent).toContainEqual({ type: 'session.commentary.append', delegation_id: 'delegate_1', content: 'Checked explanation' });
    channel.message({ type: 'session.delegation.created', delegation: { id: 'delegate_missing', target: 'client', text: 'Not actual task text' } });
    await vi.advanceTimersByTimeAsync(650); expect(delegate).toHaveBeenCalledTimes(1);
    expect(channel.sent.at(-1)?.content).toContain('did not receive a usable question transcript');
    let checked!: (value: { text: string; sourceRefs: string[] }) => void;
    delegate.mockImplementationOnce(() => new Promise(resolve => { checked = resolve; }));
    channel.message({ type: 'session.input_transcript.delta', delta: 'Can you check the sources?', end_ms: 100 });
    channel.message({ type: 'session.delegation.created', offset_ms: 110, delegation: { id: 'delegate_slow', target: 'client' } });
    await vi.advanceTimersByTimeAsync(1200);
    expect(channel.sent).toContainEqual({ type: 'session.commentary.append', delegation_id: 'delegate_slow', content: 'Hmm, checking your lesson sources.' });
    channel.message({ type: 'session.output_transcript.delta', delta: 'Hmm, checking your lesson sources.' });
    expect(audio.muted).toBe(false);
    channel.message({ type: 'session.output_transcript.delta', delta: ' Light follows a magical path.' });
    expect(audio.muted).toBe(true);
    checked({ text: 'Checked explanation', sourceRefs: ['notes'] });
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.muted).toBe(false);
    await live.ask('Can you explain the same boundary again?');
    expect(delegate).toHaveBeenCalledTimes(3);
    expect(transcript).toHaveBeenCalledWith('live_x', 'student', 'Can you explain the same boundary again?', [], 'gpt-live-1');
    expect(channel.sent).toContainEqual({ type: 'session.thinking.append', delegation_id: null, content: JSON.stringify({ learnerTypedQuestion: 'Can you explain the same boundary again?' }) });
    expect(channel.sent).toContainEqual({ type: 'session.commentary.append', delegation_id: null, content: 'Checked explanation' });
    expect(channel.sent.some(event => event.type === 'session.close')).toBe(false);
    channel.message({ type: 'session.output_transcript.delta', delta: 'Checked spoken explanation.' });
    live.stop(); expect(stopTrack).toHaveBeenCalled(); expect(audio.muted).toBe(true);
    expect(state!.status).toBe('closing'); expect(channel.sent.at(-1)).toEqual({ type: 'session.close' });
    expect(transcript).toHaveBeenCalledWith('live_x', 'student', 'Why does light bend?', [], 'gpt-live-1');
    expect(transcript).toHaveBeenCalledWith('live_x', 'avatar', 'Checked spoken explanation.', ['notes'], 'gpt-live-1');
    channel.message({ type: 'session.closed' }); expect(state!.status).toBe('off'); expect(live.active).toBe(false);
  });
  it('releases a permission result arriving after cancellation', async () => {
    vi.useFakeTimers(); const stopTrack = vi.fn(); let resolveMic!: (value: unknown) => void;
    class Channel extends EventTarget { readyState = 'open'; send = vi.fn(); close() {} }
    class Peer extends EventTarget { addTrack() {} createDataChannel() { return new Channel(); } close() {} }
    vi.stubGlobal('RTCPeerConnection', Peer); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveMic = resolve; }) } });
    const live = createLiveVoice({ pause() {}, srcObject: null } as unknown as HTMLAudioElement);
    const connecting = live.start({ connect: vi.fn(), delegate: vi.fn(), transcript: vi.fn(), state: vi.fn() });
    live.stop(); resolveMic({ getTracks: () => [{ stop: stopTrack }], getAudioTracks: () => [] }); await connecting;
    expect(stopTrack).toHaveBeenCalled(); expect(live.active).toBe(false);
  });
});
