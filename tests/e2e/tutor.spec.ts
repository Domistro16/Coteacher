import { installSyntheticMicrophone } from './synthetic-microphone';
import { expect, test, type Page } from '@playwright/test';
import { decryptPayload, encryptPayload, type LessonRecording } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';
import { teacherSources } from './teacher-navigation';
import { assertCompanionDock, openCompanionInput, closeCompanionInput } from './companion-dock';

test.use({ actionTimeout: 30000, launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });
async function saved(page: Page, id = 'student-a1b2c3d4', pin = '111111'): Promise<Snapshot> {
  const envelope = await page.evaluate(id => new Promise<unknown>((resolve, reject) => {
    const opening = indexedDB.open('coteacher-sprint'); opening.onsuccess = () => {
      const db = opening.result, request = db.transaction('profiles').objectStore('profiles').get(id);
      request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => reject(request.error);
    };
  }), id); return await decryptPayload(envelope, pin) as Snapshot;
}
async function unlock(page: Page, id = 'student-a1b2c3d4', pin = '111111') {
  await page.getByLabel('Your profile', { exact: true }).selectOption(id);
  await page.getByLabel('Six-digit PIN').fill(pin); await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect(page.getByRole('heading', { name: /Hey, Student/ })).toBeVisible();
}
async function ask(page: Page, text: string) {
  await openCompanionInput(page);
  await page.getByLabel('Which part of this recorded concept is unclear?', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Ask Coteacher', exact: true }).click();
}

test('native recording → connected mock tutor → follow-up/check → memory → offline restart/reconnect → isolated recommendations', async ({ page, browser }, info) => {
  test.skip(process.env.COTEACHER_TEST_TUTOR !== 'mock', 'Explicit mock provider required; this is not live OpenAI verification.');
  test.setTimeout(300000);
  await page.context().grantPermissions(['microphone']);
  await installSyntheticMicrophone(page);
  await page.goto('http://127.0.0.1:4274'); await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click(); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Teach / projector' }).click(); await page.getByRole('button', { name: 'Start presentation' }).click();
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect.poll(async()=>Number((await page.getByLabel('Recording duration').innerText()).split(':').at(-1))).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect.poll(async()=>Number((await page.getByLabel('Recording duration').innerText()).split(':').at(-1))).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
  await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible({ timeout: 30000 });
  const reviewAudio = page.locator('.recording-review > .recorded-lesson audio');
  await reviewAudio.evaluate((audio: HTMLAudioElement) => audio.play());
  await expect.poll(() => reviewAudio.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
  await reviewAudio.evaluate((audio: HTMLAudioElement) => audio.pause());
  await page.locator('.recording-review [data-concept-id="refraction"]').last().click();
  await expect(page.locator('.recording-review > .recorded-lesson')).toHaveAttribute('data-recorded-concept-id', 'refraction');
  await page.getByLabel('I reviewed the audio and visual timing', { exact: false }).check();
  await page.getByRole('button', { name: 'Approve recording for learners' }).click();
  await page.getByLabel('I reviewed both personalized visual sequences', { exact: false }).check();
  await page.getByRole('button', { name: 'Approve personalized playback' }).click();
  await page.getByRole('button', { name: 'Publish packages', exact: true }).click(); await page.getByRole('button', { name: 'Publish recorded lesson' }).click();
  await expect(page.getByText('Recorded lesson published to the local lesson service for both learners. They can stream it or download it for offline use.')).toBeVisible({ timeout: 60000 });

  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'allow', permissions: ['microphone'] });
  const student = await context.newPage();
  await installSyntheticMicrophone(student);
  // Explicitly simulated GPT-Live transport; native microphone permission remains real.
  // Model availability/audio are verified by the separate live probe, never by this stub.
  await student.addInitScript(() => {
    if (!sessionStorage.getItem('seeded-stale-offline-hint')) {
      localStorage.setItem('coteacher-school-offline', 'true');
      sessionStorage.setItem('seeded-stale-offline-hint', 'true');
    }
    let channel: EventTarget & { send: (text: string) => void; close: () => void; readyState: string };
    class FakeLivePeer extends EventTarget {
      iceGatheringState = 'complete'; connectionState = 'connected'; localDescription = { type: 'offer', sdp: 'v=0\r\na=simulated-voice-transport' };
      addTrack() {}
      createDataChannel() {
        channel = Object.assign(new EventTarget(), { readyState: 'open', close() { this.readyState = 'closed'; }, send(text: string) {
          if (JSON.parse(text).type === 'session.close') queueMicrotask(() => channel.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'session.closed' }) })));
          (window as unknown as { liveSent: string[] }).liveSent.push(text);
        } });
        return channel;
      }
      async createOffer() { return this.localDescription; } async setLocalDescription() {}
      async setRemoteDescription() { queueMicrotask(() => channel.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'session.started' }) }))); }
      close() {}
    }
    (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakeLivePeer;
    Object.assign(window, { liveSent: [], liveEvent: (value: unknown) => channel.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })) });
  });
  await student.route('**/api/tutor/*/*/live', async route => {
    const value = await decryptPayload(route.request().postDataJSON(), '111111') as { positionMs: number; sdp: string };
    expect(value.sdp).toContain('simulated-voice-transport');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(await encryptPayload({ session: { id: 'live_mock_transport' }, transport: { type: 'webrtc', sdp: 'simulated-answer' }, model: 'mock-live-transport' }, '111111')) });
  });
  try {
    await student.goto('http://127.0.0.1:4273'); await unlock(student);
    await expect(student.getByRole('button', { name: 'Watch Now', exact: true })).toBeEnabled({ timeout: 15000 });
    expect(await student.evaluate(() => localStorage.getItem('coteacher-school-offline'))).toBeNull();
    await student.getByRole('button', { name: 'Watch Now', exact: true }).click();
    await expect(student.getByRole('status').filter({hasText:/^Saved on this device$/})).toBeVisible({ timeout: 30000 });
    const beforeConnectionFailure = (await saved(student)).progress;
    let connectionUnavailable = true;
    await student.route('**/api/**', route => connectionUnavailable
      ? route.fulfill({ status: 503, body: 'School temporarily unavailable' }) : route.fallback());
    await student.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await context.setOffline(true);
    await student.evaluate(() => { localStorage.setItem('coteacher-school-offline', 'true'); window.dispatchEvent(new Event('offline')); });
    await student.reload(); await unlock(student);
    await student.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
    await student.getByRole('button',{name:'Try school sync',exact:true}).click();
    const connection = student.getByRole('region', { name: 'School connection', exact: true });
    await expect(connection).toContainText(/unavailable|Check the school connection/);
    await student.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Home',exact:true}).click();
    await expect(student.getByRole('button', { name: 'Watch Now', exact: true })).toBeDisabled();
    expect((await saved(student)).progress).toEqual(beforeConnectionFailure);
    connectionUnavailable = false;
    await context.setOffline(false);
    await student.evaluate(() => window.dispatchEvent(new Event('online')));
    // Recovery can complete automatically while the explicit retry is opening.
    await connection.getByRole('button', { name: 'Check connection', exact: true }).click({timeout:1500}).catch(()=>{});
    await expect(student.getByRole('button', { name: 'Watch Now', exact: true })).toBeEnabled();
    await expect(connection).toHaveCount(0);
    await student.getByRole('button', { name: 'Watch Now', exact: true }).click();
    expect((await saved(student)).progress).toEqual(beforeConnectionFailure);
    const recording = (await saved(student)).lesson.recording as LessonRecording;
    const at = Math.min(recording.durationMs - 200, recording.cues[1].offsetMs + 400);
    await student.locator('.chapters [data-concept-id="refraction"]').click();
    await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement, at) => { audio.currentTime = at / 1000; }, at);
    await student.evaluate(() => {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const state = window as unknown as { liveMicRequests: number };
      state.liveMicRequests = 0;
      navigator.mediaDevices.getUserMedia = constraints => { state.liveMicRequests++; return capture(constraints); };
    });
    await student.getByRole('button', { name: 'Talk with Coteacher', exact: true }).click();
    const dialog = student.getByRole('region', { name: 'Coteacher lesson companion', exact: true }); await expect(dialog).toHaveAttribute('data-concept-id', 'refraction');
    const paused = await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.currentTime);
    const spoken = student.locator('[data-companion-audio]');
    await expect(spoken).toHaveJSProperty('paused', true);
    await expect(student.getByLabel('Enable connected tutoring and learning memory')).toBeVisible();
    expect(await student.evaluate(() => (window as any).liveMicRequests)).toBe(0);
    expect(await student.evaluate(() => (window as any).liveSent.length)).toBe(0);
    await student.getByLabel('Enable connected tutoring and learning memory').check();
    await student.getByText('Connection options', {exact:true}).click();
    await expect(student.getByText('Your connected answers and learning history are saved.', {exact:true})).toBeVisible({timeout:60000});
    await student.getByRole('button', {name:'Record a voice question',exact:true}).click();
    await expect(student.getByRole('button', {name:'Stop voice question',exact:true})).toBeVisible();
    await student.waitForTimeout(800);
    await student.getByRole('button', {name:'Stop voice question',exact:true}).click();
    await expect(student.getByText(/check the text, then send your question/)).toBeVisible({timeout:60000});
    await student.getByRole('button', {name:'Type instead',exact:true}).click();
    await expect(student.getByLabel('Which part of this recorded concept is unclear?', {exact:true})).toHaveValue('Why does light change direction when it enters water?', {timeout:60000});
    // Native capture with an explicitly mocked WebRTC transport: no live API claim.
    await student.getByRole('button', {name:'Talk by voice',exact:true}).click();
    const live = student.getByRole('region', {name:'Coteacher live companion',exact:true});
    await expect(live).toContainText('talking with Coteacher (connected)', {timeout:30000});
    await student.evaluate(() => {
      const w = window as any;
      w.liveEvent({type:'session.input_transcript.delta',delta:'Why does the pencil look bent in water?',start_ms:0,end_ms:100});
      w.liveEvent({type:'session.delegation.created',offset_ms:200,delegation:{id:'prepared-delegation',target:'client'}});
    });
    await expect.poll(() => student.evaluate(() => (window as any).liveSent.some((text:string) => JSON.parse(text).delegation_id === 'prepared-delegation')), {timeout:30000}).toBe(true);
    await student.evaluate(() => (window as any).liveEvent({type:'session.output_transcript.delta',delta:'Prepared answer spoken by simulated live transport.'}));
    await live.getByRole('button', {name:'End live conversation',exact:true}).click();
    await expect.poll(async () => (await saved(student)).tutor?.liveTurns?.length, {timeout:30000}).toBe(2);
    expect((await saved(student)).tutor!.liveTurns![0]).toMatchObject({role:'student',conceptId:'refraction',positionMs:Math.round(paused*1000)});
    expect((await saved(student)).tutor!.liveTurns![1].sourceRefs.length).toBeGreaterThan(0);
    await ask(student, 'What changes if the water is syrup instead?');
    await student.getByText('Read answer & sources', {exact:true}).click();
    await expect(student.locator('[data-tutor-status="answered"]')).toBeVisible({timeout:60000});
    await expect(spoken).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => spoken.evaluate((audio:HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
    expect(await student.locator('.recorded-lesson audio').evaluate((audio:HTMLAudioElement) => audio.paused)).toBe(true);
    expect(await student.locator('.recorded-lesson audio').evaluate((audio:HTMLAudioElement) => audio.currentTime)).toBeCloseTo(paused,2);
    await student.getByText('Read answer & sources', {exact:true}).click();
    await ask(student, 'Can you describe that last point using the same example?');
    await expect.poll(async () => (await saved(student)).tutor?.replies.filter(r=>r.status==='answered').length, {timeout:60000}).toBe(2);
    await student.getByRole('button', {name:'It makes sense now',exact:true}).click();
    await student.getByRole('button', {name:'Try a quick check',exact:true}).click();
    const checkModal = student.getByRole('dialog', {name:'Your quick check',exact:true});
    await expect.poll(async () => (await saved(student)).tutor?.checks?.length, {timeout:60000}).toBe(1);
    const check = (await saved(student)).tutor!.checks![0];
    await checkModal.getByRole('button', {name:check.options[(check.correctIndex+1)%check.options.length],exact:true}).click();
    await expect.poll(async () => (await saved(student)).tutor?.memory.recommendations[0]?.visualAssetId, {timeout:60000}).toBe('refraction-pencil');
    await checkModal.getByRole('button', {name:'Return to recorded lesson',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await student.locator('.recorded-lesson audio').evaluate((audio:HTMLAudioElement, at) => {audio.pause();audio.currentTime=at;}, paused);
    const nav = student.getByRole('navigation', {name:'Main navigation'});
    await nav.getByRole('button', {name:'Downloads',exact:true}).click();
    await student.getByRole('button', {name:'Download for offline use',exact:true}).click();
    await expect(student.getByText('Ready offline', {exact:true}).first()).toBeVisible({timeout:60000});
    await student.getByRole('button', {name:/Continue Watching|Watch Offline/,exact:true}).first().click();
    await context.setOffline(true);await student.evaluate(() => window.dispatchEvent(new Event('offline')));
    await student.getByRole('button', {name:'Talk with Coteacher',exact:true}).click();
    await assertCompanionDock(student);
    await expect(spoken).toHaveJSProperty('paused',true);
    await ask(student,'Why does the pencil look bent in water?');
    await student.getByText('Read answer & sources', {exact:true}).click();
    await expect(student.locator('.companion-answer-details')).toContainText('Light');
    const pending='Could the same idea explain a purple ocean on another planet?';
    await ask(student,pending);
    await expect.poll(async () => (await saved(student)).progress.queuedQuestions.some(q=>q.text===pending&&!q.answered)).toBe(true);
    const alternatives=student.locator('.companion-more');
    if(!await alternatives.evaluate(e=>(e as HTMLDetailsElement).open))await alternatives.locator(':scope > summary').click();
    await alternatives.getByRole('button',{name:'Try it activity',exact:true}).click();
    const activityPanel=student.getByRole('region',{name:'Current concept activity or check',exact:true});
    await expect(activityPanel).toContainText('Gather these');
    await student.getByRole('button',{name:'Start activity',exact:true}).click();
    const activity=(await saved(student)).lesson.concepts.find(c=>c.id==='refraction')!.variants.find(v=>v.type==='tryit')!;
    if(activity.type!=='tryit')throw new Error('Missing approved activity');
    for(let i=0;i<activity.steps.length;i++)await student.getByRole('button',{name:i+1===activity.steps.length?'See why it works':'Next instruction',exact:true}).click();
    await expect(activityPanel).toContainText(activity.explainsWhy);
    await student.getByRole('button',{name:/finished.*check my understanding/}).click();
    const prepared=(await saved(student)).lesson.quiz.find(q=>q.conceptId==='refraction')!;
    await checkModal.getByRole('button',{name:prepared.options[prepared.correctIndex],exact:true}).click();
    await expect(checkModal.locator('.quiz-feedback')).toContainText('Nice thinking!');
    await checkModal.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();
    await student.locator('.recorded-lesson audio').evaluate((audio:HTMLAudioElement)=>audio.pause());
    const offlineA=await saved(student);const pendingQuestion=offlineA.progress.queuedQuestions.find(q=>q.text===pending)!;
    await student.reload();await unlock(student);
    expect((await saved(student)).progress.queuedQuestions.find(q=>q.id===pendingQuestion.id)).toEqual(pendingQuestion);
    await context.setOffline(false);await student.evaluate(()=>window.dispatchEvent(new Event('online')));
    await expect.poll(async ()=>(await saved(student)).tutor?.replies.find(r=>r.originalText===pending)?.status,{timeout:60000}).toBe('answered');
    const completedA = await saved(student);
    await student.getByRole('button',{name:'Lock / switch learner',exact:true}).click();await unlock(student,'student-b1c2d3e4','222222');
    await student.getByRole('button',{name:'Watch Now',exact:true}).click();
    await student.locator('.chapters [data-concept-id="refraction"]').click();
    await student.getByRole('button',{name:'Talk with Coteacher',exact:true}).click();
    await assertCompanionDock(student);
    await student.getByLabel('Use connected AI answers',{exact:true}).check();
    await closeCompanionInput(student);
    const b=await saved(student,'student-b1c2d3e4','222222');
    const title=b.lesson.visualAssets!.find(asset=>asset.id==='refraction-steps')!.title;
    const more=student.locator('.companion-more');if(!await more.evaluate(e=>(e as HTMLDetailsElement).open))await more.locator(':scope > summary').click();
    await more.getByRole('button',{name:title,exact:true}).click();
    await expect.poll(async ()=>(await saved(student,'student-b1c2d3e4','222222')).tutor?.memory.recommendations[0]?.visualAssetId,{timeout:60000}).toBe('refraction-steps');
    expect((await saved(student,'student-b1c2d3e4','222222')).progress.queuedQuestions).toHaveLength(0);
    expect((await saved(student)).tutor?.memory).toEqual(completedA.tutor?.memory);
    expect((await saved(student)).lesson.recording!.id).toBe(b.lesson.recording!.id);
    await student.screenshot({path:info.outputPath('connected-tutor-mobile.png'),fullPage:true});
    await student.setViewportSize({width:1440,height:1000});await student.screenshot({path:info.outputPath('connected-tutor-desktop.png'),fullPage:true});
    await student.getByLabel('Seek recorded lesson',{exact:true}).fill('0');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button',{name:'Questions',exact:true}).click();
    await expect(page.getByText('Mock provider', {exact:false})).toBeVisible();
  } finally { await context.close(); }
});
