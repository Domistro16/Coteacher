import { expect, test, type Page } from '@playwright/test';
import { decryptPayload, encryptPayload, type LessonRecording } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';
import { teacherSources } from './teacher-navigation';
import { assertCompanionDock } from './companion-dock';

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
  await page.getByLabel('Which part of this recorded concept is unclear?', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Ask Coteacher', exact: true }).click();
}

test('native recording → connected mock tutor → follow-up/check → memory → offline restart/reconnect → isolated recommendations', async ({ page, browser }, info) => {
  test.skip(process.env.COTEACHER_TEST_TUTOR !== 'mock', 'Explicit mock provider required; this is not live OpenAI verification.');
  test.setTimeout(300000);
  await page.context().grantPermissions(['microphone']);
  await page.goto('http://127.0.0.1:4274'); await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click(); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Teach / projector' }).click(); await page.getByRole('button', { name: 'Start presentation' }).click();
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200); await page.getByRole('button', { name: 'Next visual' }).click(); await page.waitForTimeout(1200);
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
    await expect(student.getByText('Saved on this device', { exact: true })).toBeVisible({ timeout: 30000 });
    const beforeConnectionFailure = (await saved(student)).progress;
    let connectionUnavailable = true;
    await student.route('**/api/health', route => connectionUnavailable
      ? route.fulfill({ status: 503, body: 'School temporarily unavailable' }) : route.continue());
    await student.evaluate(() => localStorage.setItem('coteacher-school-offline', 'true'));
    await student.reload(); await unlock(student);
    const connection = student.getByRole('region', { name: 'School connection', exact: true });
    await expect(connection).toContainText('unavailable right now');
    await expect(student.getByRole('button', { name: 'Watch Now', exact: true })).toBeDisabled();
    expect((await saved(student)).progress).toEqual(beforeConnectionFailure);
    connectionUnavailable = false;
    await connection.getByRole('button', { name: 'Check connection', exact: true }).click();
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
    const introAudio = student.locator('[data-companion-audio]');
    await expect.poll(() => introAudio.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    await expect.poll(async () => Number(await student.locator('.recorded-help svg').getAttribute('data-motion-phase')), { timeout: 10000 }).toBeGreaterThan(.85);
    await assertCompanionDock(student);
    await student.screenshot({ path: info.outputPath('docked-companion-mobile.png'), fullPage: true });
    await student.setViewportSize({ width: 1440, height: 1000 }); await assertCompanionDock(student);
    await student.screenshot({ path: info.outputPath('docked-companion-desktop.png'), fullPage: true });
    for (const width of [320, 768]) { await student.setViewportSize({ width, height: 900 }); await assertCompanionDock(student); }
    await student.setViewportSize({ width: 360, height: 800 });
    await student.locator('.companion-lesson-tools').getByRole('button', { name: 'Talk by voice', exact: true }).click();
    await expect(student.getByLabel('Enable connected tutoring and learning memory')).toBeVisible();
    expect(await student.evaluate(() => (window as unknown as { liveSent: string[] }).liveSent.length)).toBe(0);
    expect(await student.evaluate(() => (window as unknown as { liveMicRequests: number }).liveMicRequests)).toBe(0);
    await student.getByLabel('Enable connected tutoring and learning memory').check();
    await expect(student.getByText('Your connected answers and learning history are saved.', { exact: true })).toBeVisible({ timeout: 60000 });
    await student.getByRole('button', { name: 'Start live conversation', exact: true }).click();
    await expect(student.getByRole('region', { name: 'Coteacher live companion' })).toBeVisible();
    await expect(student.getByRole('region', { name: 'Coteacher live companion' })).toContainText('Live microphone on · talking with Coteacher (connected)');
    expect(await student.evaluate(() => (window as unknown as { liveMicRequests: number }).liveMicRequests)).toBe(1);
    expect(await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await student.evaluate(() => {
      const w = window as unknown as { liveEvent: (value: unknown) => void };
      w.liveEvent({ type: 'session.input_transcript.delta', delta: 'Why does the pencil look bent in water?', start_ms: 0, end_ms: 100 });
      w.liveEvent({ type: 'session.delegation.created', offset_ms: 200, delegation: { id: 'prepared-delegation', target: 'client' } });
    });
    await expect.poll(() => student.evaluate(() => (window as unknown as { liveSent: string[] }).liveSent.some(text => JSON.parse(text).delegation_id === 'prepared-delegation')), { timeout: 30000 }).toBe(true);
    await student.evaluate(() => (window as unknown as { liveEvent: (value: unknown) => void }).liveEvent({ type: 'session.output_transcript.delta', delta: 'Prepared answer spoken by simulated live transport.' }));
    await student.getByRole('region', { name: 'Coteacher live companion' }).getByRole('button', { name: 'End live conversation', exact: true }).click();
    await expect.poll(async () => (await saved(student)).tutor?.liveTurns?.length, { timeout: 30000 }).toBe(2);
    expect((await saved(student)).tutor!.liveTurns![0]).toMatchObject({ role: 'student', conceptId: 'refraction', text: 'Why does the pencil look bent in water?', positionMs: Math.round(paused * 1000) });
    expect((await saved(student)).tutor!.liveTurns![1].sourceRefs.length).toBeGreaterThan(0);
    await student.getByText('Voice & connection', { exact: true }).click();
    await student.getByRole('button', { name: 'Ask by voice · connected' }).click();
    await expect(student.getByText('Microphone on · listening to your question (up to 20 seconds)', { exact: true })).toBeVisible();
    await student.waitForTimeout(800); await student.getByRole('button', { name: 'Stop voice question' }).click();
    await expect(student.getByLabel('Which part of this recorded concept is unclear?', { exact: true })).toHaveValue('Why does light change direction when it enters water?', { timeout: 60000 });
    await ask(student, 'What changes if the water is syrup instead?');
    await expect(student.locator('[data-tutor-status="answered"]')).toBeVisible({ timeout: 60000 });
    await expect(student.locator('[data-tutor-status]')).toContainText('Mocked connected answer');
    const spoken = student.locator('[data-companion-audio]'); await expect(spoken).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => spoken.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
    expect(await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    expect(await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeCloseTo(paused, 2);
    await ask(student, 'Can you describe that last point using the same example?');
    await expect.poll(async () => (await saved(student)).tutor?.replies.filter(reply => reply.status === 'answered').length, { timeout: 60000 }).toBe(2);
    await student.getByRole('button', { name: 'It makes sense now' }).click();
    await student.getByRole('button', { name: 'Try a quick check', exact: true }).click();
    const a = await saved(student), quiz = a.lesson.quiz.find(quiz => quiz.conceptId === 'refraction')!;
    await student.getByRole('button', { name: quiz.options[(quiz.correctIndex + 1) % quiz.options.length], exact: true }).click();
    await expect.poll(async () => (await saved(student)).tutor?.memory.recommendations[0]?.visualAssetId, { timeout: 60000 }).toBe('refraction-pencil');
    await student.getByRole('button', { name: 'Close learning panel' }).click();
    expect(await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeCloseTo(paused, 2);
    await student.getByRole('button', { name: 'Talk with Coteacher', exact: true }).click();
    await expect.poll(async () => (await saved(student)).tutor?.replies.filter(reply => reply.status === 'answered').length, { timeout: 60000 }).toBe(3);
    await student.getByRole('button', { name: 'Ask or explore this concept', exact: true }).click();
    await expect(student.locator('[data-tutor-status="answered"]')).toBeVisible();
    await expect.poll(() => spoken.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => {
      const state = window as unknown as { resumedAt?: number }; state.resumedAt = undefined;
      audio.addEventListener('play', () => { state.resumedAt = audio.currentTime; }, { once: true });
    });
    await student.getByRole('button', { name: 'Return to recorded lesson', exact: true }).click();
    await expect.poll(() => student.evaluate(() => (window as unknown as { resumedAt?: number }).resumedAt)).toBeCloseTo(paused, 1);
    await expect(dialog).toHaveCount(0);
    // Reset the native clock for the separate offline/restart anchor checks below.
    await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement, at) => { audio.pause(); audio.currentTime = at; }, paused);
    const nav = student.getByRole('navigation', { name: 'Main navigation' }); await nav.getByRole('button', { name: 'Downloads', exact: true }).click();
    await student.getByRole('button', { name: 'Download for offline use', exact: true }).click();
    await expect(student.getByText('Ready offline', { exact: true }).first()).toBeVisible({ timeout: 60000 });
    await student.getByRole('button', { name: /Continue Watching|Watch Offline/, exact: true }).first().click();
    await context.setOffline(true); await student.evaluate(() => window.dispatchEvent(new Event('offline')));
    await student.getByText('Offline voice options', { exact: true }).click();
    await student.locator('.lesson-voice-control').getByRole('button', { name: 'Enable offline voice mode', exact: true }).click();
    await expect(student.locator('.lesson-voice-control')).toContainText('Offline voice is unavailable on this device. Please type your question.');
    await student.getByRole('button', { name: 'Talk with Coteacher', exact: true }).click();
    await assertCompanionDock(student);
    await expect.poll(() => spoken.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    await ask(student, 'Why does the pencil look bent in water?'); await expect(student.locator('.help-response')).toContainText('Prepared offline answer');
    const pending = 'Could the same idea explain a purple ocean on another planet?'; await ask(student, pending);
    await expect(student.locator('.help-response')).toContainText('Pending');
    await student.getByRole('button', { name: 'Let’s try it', exact: true }).click();
    await expect(student.locator('.companion-lesson-tools .activity')).toContainText('Gather these');
    await student.getByRole('button', { name: 'Start activity', exact: true }).click();
    const activity = (await saved(student)).lesson.concepts.find(concept => concept.id === 'refraction')!.variants.find(variant => variant.type === 'tryit')!;
    if (activity.type !== 'tryit') throw new Error('Reviewed refraction activity missing');
    for (let step = 0; step < activity.steps.length; step++) await student.getByRole('button', { name: step + 1 === activity.steps.length ? 'See why it works' : 'Next instruction', exact: true }).click();
    await expect(student.locator('.companion-lesson-tools .activity')).toContainText(activity.explainsWhy);
    await student.getByRole('button', { name: 'I’ve finished · check my understanding', exact: true }).click();
    await expect(student.locator('.companion-lesson-tools .quiz-card')).toBeVisible();
    await student.getByRole('button', { name: quiz.options[quiz.correctIndex], exact: true }).click();
    await expect(student.locator('.companion-lesson-tools .quiz-feedback')).toContainText('Nice thinking!');
    await assertCompanionDock(student);
    expect(await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await student.getByRole('button', { name: 'Close learning panel' }).click();
    await expect.poll(async () => (await saved(student)).progress.queuedQuestions.some(question => question.text === pending)).toBe(true);
    await student.reload(); await unlock(student); await student.getByRole('button', { name: /Continue Watching|Watch Offline/, exact: true }).first().click();
    const restart = await saved(student); expect(restart.tutor?.memory.recommendations[0]?.visualAssetId).toBe('refraction-pencil');
    expect(restart.tutor?.liveTurns?.length).toBe(2);
    expect(restart.player.recording!.positionMs).toBeCloseTo(paused * 1000, -1);
    await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.play());
    await expect.poll(() => student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(paused);
    await student.locator('.recorded-lesson audio').evaluate((audio: HTMLAudioElement) => audio.pause());
    await context.setOffline(false); await student.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await saved(student)).tutor?.replies.find(reply => reply.originalText === pending)?.status, { timeout: 60000 }).toBe('answered');
    await student.getByRole('button', { name: 'Lock / switch learner' }).click(); await unlock(student, 'student-b1c2d3e4', '222222');
    await student.getByRole('button', { name: 'Watch Now', exact: true }).click();
    await student.locator('.chapters [data-concept-id="refraction"]').click(); await student.getByRole('button', { name: 'I don’t understand', exact: true }).click();
    await assertCompanionDock(student);
    await student.getByText('Voice & connection', { exact: true }).click(); await student.getByLabel('Enable connected tutoring and learning memory').check();
    const b = await saved(student, 'student-b1c2d3e4', '222222'), title = b.lesson.visualAssets!.find(asset => asset.id === 'refraction-steps')!.title;
    await student.getByText('More ways to learn', { exact: true }).click();
    await student.getByRole('navigation', { name: 'Prepared concept representations' }).getByRole('button', { name: title, exact: true }).click();
    await expect.poll(async () => (await saved(student, 'student-b1c2d3e4', '222222')).tutor?.memory.recommendations[0]?.visualAssetId, { timeout: 60000 }).toBe('refraction-steps');
    expect((await saved(student, 'student-b1c2d3e4', '222222')).progress.queuedQuestions).toHaveLength(0);
    expect((await saved(student)).tutor?.memory.recommendations[0]?.visualAssetId).toBe('refraction-pencil');
    expect((await saved(student)).lesson.recording!.id).toBe(b.lesson.recording!.id);
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await student.screenshot({ path: info.outputPath('connected-tutor-mobile.png'), fullPage: true });
    await student.setViewportSize({ width: 1440, height: 1000 }); await student.screenshot({ path: info.outputPath('connected-tutor-desktop.png'), fullPage: true });
    await student.getByLabel('Seek recorded lesson', { exact: true }).fill('0');
    await expect(student.getByRole('region', { name: 'Coteacher lesson companion', exact: true })).toHaveCount(0);
    await expect(student.locator('.recorded-lesson')).toHaveAttribute('data-recorded-concept-id', 'light-path');
    await page.getByRole('button', { name: 'Questions', exact: true }).click();
    await expect(page.getByText('Mock provider · test responses.', { exact: false })).toBeVisible();
  } finally { await context.close(); }
});
