import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { profiles } from '@coteacher/shared';
import { LessonDeliveryStore } from './store';
import { ProgressReturnStore } from './progress-store';
import { OpenAILiveVoice } from './live-provider';
import { OpenAITutor } from './tutor-provider';
import { tutorSources, checkedAnswer } from './tutor-store';

/** Explicit billable real-model probe, separate from mock browser tests.
 * No school progress is modified. Microphone input is a simulated Chrome device. */
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
if (!process.env.OPENAI_API_KEY) { console.log('UNVERIFIED: configure a server key. No API call made.'); process.exit(2); }
const lessons = new LessonDeliveryStore(resolve(process.env.COTEACHER_DELIVERY_DIR ?? '.coteacher-delivery'));
await lessons.restore();
const school = new ProgressReturnStore(resolve(process.env.COTEACHER_DELIVERY_DIR ?? '.coteacher-delivery'), lessons);
const lesson = await school.lesson(profiles[0].id), cue = lesson.recording!.cues.find(cue => cue.conceptId === 'refraction');
if (!cue) throw new Error('Publish an actual reviewed science recording first.');
const question = 'How can a lens in eyeglasses bend light, and how does that connect to this water lesson?';
await mkdir(resolve('.task-tmp'), { recursive: true });
const simulatedMic = resolve('.task-tmp/avatar-test-question.wav');
if (process.platform !== 'win32') throw new Error('This explicit probe uses Windows SAPI only to make simulated student microphone input. It is not the avatar voice.');
execFileSync('powershell.exe', ['-NoProfile', '-Command', '$voice = New-Object -ComObject SAPI.SpVoice; $stream = New-Object -ComObject SAPI.SpFileStream; $stream.Format.Type = 22; $stream.Open($env:COTEACHER_PROBE_WAV, 3); $voice.AudioOutputStream = $stream; [void]$voice.Speak($env:COTEACHER_PROBE_QUESTION); $stream.Close()'], { env: { ...process.env, COTEACHER_PROBE_WAV: simulatedMic, COTEACHER_PROBE_QUESTION: question }, stdio: 'ignore' });
const input = { question, objective: lesson.objective.text, concept: lesson.concepts.find(concept => concept.id === cue.conceptId)!.title, classLevel: lesson.classLevel,
  sources: tutorSources(lesson, cue.conceptId, question), visuals: (lesson.visualAssets ?? []).filter(asset => asset.conceptId === cue.conceptId).map(asset => ({ id: asset.id, title: asset.title, annotations: asset.layers.filter(layer => layer.kind === 'text').map(layer => layer.text) })), history: [], observations: [] };
const browser = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + simulatedMic, '--autoplay-policy=no-user-gesture-required'] });
type Probe = { events: { type: string; delegation?: { id: string; target: string }; delta?: string }[]; peak: number; audioTime: number; sessionClosed: boolean; debug(): Promise<unknown>; send(value: unknown): void; mute(): void; end(): void };
let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;
try {
  page = await browser.newPage(); await page.context().grantPermissions(['microphone']);
  await page.goto(process.env.COTEACHER_VOICE_PROBE_ORIGIN ?? 'http://127.0.0.1:5174');
  const sdp = await page.evaluate(async () => {
    const peer = new RTCPeerConnection(), audio = new Audio(); audio.autoplay = true;
    document.body.append(audio); const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const channel = peer.createDataChannel('oai-events'), events: Record<string, unknown>[] = [];
    const probe = { events, peak: 0, sessionClosed: false, send(value: unknown) { channel.send(JSON.stringify(value)); },
      get audioTime() { return audio.currentTime; }, async answer(sdp: string) { await peer.setRemoteDescription({ type: 'answer', sdp }); },
      async debug() { const stats = await peer.getStats(); const incoming: unknown[] = []; stats.forEach(stat => { if (stat.type === 'inbound-rtp' && (stat.kind === 'audio' || stat.mediaType === 'audio' || typeof stat.totalAudioEnergy === 'number')) incoming.push({ bytes: stat.bytesReceived, packets: stat.packetsReceived, totalAudioEnergy: stat.totalAudioEnergy, duration: stat.totalSamplesDuration, samples: stat.totalSamplesReceived }); }); return { incoming, hidden: document.hidden, audioPaused: audio.paused, audioMuted: audio.muted }; },
      mute() { mic.getAudioTracks().forEach(track => { track.enabled = false; }); },
      end() { mic.getTracks().forEach(track => track.stop()); channel.close(); peer.close(); audio.pause(); } };
    Object.assign(window, { coteacherLiveProbe: probe });
    channel.addEventListener('message', event => { const value = JSON.parse(event.data); events.push(value); if (value.type === 'session.closed') probe.sessionClosed = true; });
    peer.addEventListener('track', event => {
      if (event.track.kind !== 'audio') return;
      const stream = new MediaStream([event.track]); audio.srcObject = stream; void audio.play();
    });
    for (const track of mic.getTracks()) peer.addTrack(track, mic);
    await peer.setLocalDescription(await peer.createOffer());
    if (peer.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ICE gathering timed out')), 10000);
      peer.addEventListener('icegatheringstatechange', () => { if (peer.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); } });
    });
    return peer.localDescription!.sdp;
  });
  const voice = new OpenAILiveVoice(process.env.OPENAI_API_KEY);
  const connection = await voice.create(sdp, { concept: input.concept, objective: input.objective, classLevel: input.classLevel });
  await page.evaluate(sdp => (window as unknown as { coteacherLiveProbe: { answer(sdp: string): Promise<void> } }).coteacherLiveProbe.answer(sdp), connection.transport.sdp);
  await page.waitForFunction(() => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.events.some(event => event.type === 'session.started'), { timeout: 30000 });
  // The WAV is deliberate test input. GPT-Live itself recognizes the spoken question.
  await page.waitForFunction(() => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.events.some(event => event.type === 'session.delegation.created' && event.delegation?.target === 'client'), { timeout: 30000 });
  const delegationId = await page.evaluate(() => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.events.find(event => event.type === 'session.delegation.created' && event.delegation?.target === 'client')!.delegation!.id);
  const reasoner = new OpenAITutor(process.env.OPENAI_API_KEY), answer = await reasoner.answer(input), checked = checkedAnswer(answer, input);
  if (!checked) throw new Error('The real reasoning answer failed source checks; no explanation sent to voice.');
  await page.evaluate(({ id, text }) => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.send({ type: 'session.commentary.append', delegation_id: id, content: text }), { id: delegationId, text: answer.text });
  await page.waitForFunction(async () => { const p = (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe; const stats = await p.debug() as { incoming: { totalAudioEnergy: number }[] }; return stats.incoming.some(stat => stat.totalAudioEnergy > .001) && p.audioTime > .1 && p.events.filter(event => event.type === 'session.output_transcript.delta').map(event => event.delta).join('').toLowerCase().includes('light'); }, undefined, { timeout: 30000 });
  // Leave time for the actual explanatory speech, not just its acknowledgment.
  await page.waitForTimeout(5000);
  await page.evaluate(() => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.send({ type: 'session.close' }));
  await page.waitForFunction(() => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.sessionClosed, { timeout: 15000 });
  const received = await page.evaluate(() => { const p = (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe; return { audioTime: p.audioTime, sessionClosed: p.sessionClosed, transcript: p.events.filter(event => event.type === 'session.output_transcript.delta').map(event => event.delta).join('') }; });
  const statistics = await page.evaluate(() => (window as unknown as { coteacherLiveProbe: Probe }).coteacherLiveProbe.debug());
  const proof = { result: 'PASS', voiceModel: voice.model, reasoningModel: reasoner.model, delegation: 'client', citations: checked.citations.map(source => ({ title: source.title, locator: source.locator })), decodedAudio: statistics, ...received,
    scope: 'Real GPT-Live WebRTC session, actual Responses reasoning and decoded generated voice. Simulated microphone input and a known application task; not a physical-microphone or full student UI conversation test. No school records changed.' };
  await mkdir(resolve('.task-tmp'), { recursive: true }); await writeFile(resolve('.task-tmp/live-avatar-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
} catch (error) {
  const partial = page && await page.evaluate(async () => { const p = (window as unknown as { coteacherLiveProbe?: Probe }).coteacherLiveProbe; return p ? { peak: p.peak, audioTime: p.audioTime, debug: await p.debug(), eventTypes: p.events.map(event => event.type), transcripts: p.events.filter(event => event.type.includes('transcript')).map(event => ({ type: event.type, delta: event.delta })), sessionClosed: p.sessionClosed } : {}; }).catch(() => ({}));
  await writeFile(resolve('.task-tmp/live-avatar-proof.json'), JSON.stringify({ result: 'PARTIAL', error: (error as Error).message, ...partial }, null, 2));
  throw error;
} finally {
  if (page) await page.evaluate(() => { const p = (window as unknown as { coteacherLiveProbe?: Probe }).coteacherLiveProbe; try { if (p && !p.sessionClosed) p.send({ type: 'session.close' }); } catch {} p?.end(); }).catch(() => {});
  await browser.close();
}
