import { openPreparedCompatibility } from './compatibility';
import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { assertPlaybackMotion, assertWatermark } from './motion-assertions';
import { verifyCompanionConversation } from './companion-conversation';
import { assertCompanionDock } from './companion-dock';
import { decryptPayload, recordingAudioBytes, type LessonRecording } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';

const a = 'student-a1b2c3d4', b = 'student-b1c2d3e4';
async function unlock(page: Page, id = a, pin = '111111') {
  await page.getByLabel('Your profile', { exact: true }).selectOption(id);
  await page.getByLabel('Six-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect(page.getByRole('heading', { name: /Hey, Student/ })).toBeVisible();
  const resume = page.getByRole('button', { name: 'Continue Watching', exact: true });
  if (await resume.isVisible()) await resume.click();
}
async function lock(page: Page) {
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
}
async function rows(page: Page) {
  return page.evaluate(() => new Promise<any>(resolve => {
    const open = indexedDB.open('coteacher-sprint'); open.onsuccess = () => {
      const db = open.result, tx = db.transaction(['profiles', 'media']), store = tx.objectStore('profiles');
      const keys = store.getAllKeys(), values = store.getAll(), media = tx.objectStore('media').count();
      tx.oncomplete = () => { db.close(); resolve({ keys: keys.result, values: values.result, media: media.result }); };
    };
  }));
}
async function saved(page: Page, id = a, pin = '111111'): Promise<Snapshot> {
  const data = await rows(page); return await decryptPayload(data.values[data.keys.indexOf(id)], pin) as Snapshot;
}

/** Starts from the actual native microphone recording approved in recording.spec.ts. */
export async function verifyDeliveredReplay(browser: Browser, recording: LessonRecording, info: TestInfo, teacher?: Page) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  let page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4273'); await unlock(page);
    // An already-collected legacy lesson must upgrade without erasing its work.
    await openPreparedCompatibility(page);
    await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
    await page.getByRole('button', { name: 'Collect demo lesson' }).click();
    await page.getByLabel('Type your question').fill('Why is there a rainbow on the Moon?');
    await page.getByRole('button', { name: 'Send question', exact: true }).click();
    await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
    const legacy = await saved(page);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Find my teacher’s lesson' }).click();
    await page.getByRole('button', { name: 'Watch Now', exact: true }).click();
    const player = page.locator('.recorded-lesson'), audio = player.locator('audio');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.locator('.video-card')).toContainText('Science');
    await expect(page.locator('.video-card')).toContainText('Your classroom teacher');
    await page.screenshot({ path: info.outputPath('student-home-real-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: info.outputPath('student-home-real-desktop.png'), fullPage: true });
    await nav.getByRole('button', { name: 'My Lessons', exact: true }).click();
    await page.getByRole('button', { name: 'Science', exact: true }).click();
    await expect(page.locator('.video-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Watch Now', exact: true }).click();
    await expect(audio).toHaveAttribute('src', /^\/api\/recorded-lessons\//);
    await page.screenshot({ path: info.outputPath('student-player-real-desktop.png'), fullPage: true });
    await page.getByLabel('Playback speed').selectOption('1.25');
    expect(await audio.evaluate((element: HTMLAudioElement) => element.playbackRate)).toBe(1.25);
    await page.getByLabel('Playback speed').selectOption('1');
    await page.getByRole('button', { name: 'Expand lesson player' }).click();
    await expect(page.getByRole('button', { name: 'Exit expanded view' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit expanded view' }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await expect(player).toBeVisible(); await expect(page.locator('.study-support')).toBeHidden();
    await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(0);
    await expect(audio).toHaveAttribute('src', /^\/api\/recorded-lessons\//);
    const streamUrl = (await audio.getAttribute('src'))!; expect(streamUrl).toMatch(/^\/api\/recorded-lessons\//);
    const range = await page.request.get('http://127.0.0.1:4273' + streamUrl, { headers: { Range: 'bytes=0-31' } });
    expect(range.status()).toBe(206); expect((await range.body()).length).toBe(32); expect(range.headers()['accept-ranges']).toBe('bytes');
    const invalidRange = await page.request.get('http://127.0.0.1:4273' + streamUrl, { headers: { Range: 'bytes=999999999-' } }); expect(invalidRange.status()).toBe(416);
    const original = Buffer.from(recordingAudioBytes(recording));
    expect(await (await page.request.get('http://127.0.0.1:4273' + streamUrl)).body()).toEqual(original);
    const signal = await audio.evaluate(async (element: HTMLAudioElement) => {
      const graph = new AudioContext(), decoded = await graph.decodeAudioData(await (await fetch(element.src)).arrayBuffer());
      const samples = decoded.getChannelData(0); const energy = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      await graph.close(); return { energy, duration: decoded.duration };
    });
    expect(signal.energy).toBeGreaterThan(.0001); expect(signal.duration).toBeCloseTo(recording.durationMs / 1000, 1);
    await audio.evaluate((element: HTMLAudioElement) => element.play());
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(.3);
    await audio.evaluate((element: HTMLAudioElement) => element.pause());
    await page.getByLabel('Seek recorded lesson').focus(); await page.keyboard.press('Home');
    await expect(player).toHaveAttribute('data-recorded-step-id', 'step-light');
    await page.getByRole('button', { name: 'Forward 10 seconds', exact: true }).click();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeCloseTo(Math.min(10, recording.durationMs / 1000), 1);
    const tenSecondCue = recording.cues.filter(cue => cue.offsetMs <= Math.min(10000, recording.durationMs)).at(-1)!;
    await expect(player).toHaveAttribute('data-recorded-step-id', tenSecondCue.timelineStepId);
    await page.getByRole('button', { name: 'Back 10 seconds', exact: true }).click();
    await expect(player).toHaveAttribute('data-recorded-step-id', 'step-light');
    await page.getByRole('button', { name: 'Replay this section', exact: true }).click();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
    await audio.evaluate((element: HTMLAudioElement, ms) => { element.pause(); element.currentTime = ms / 1000; }, recording.cues[4].offsetMs);
    await expect(player.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-pencil');
    await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
    const upgraded = await saved(page);
    expect(upgraded.progress.queuedQuestions).toEqual(legacy.progress.queuedQuestions);
    expect(upgraded.progress.events.slice(0, legacy.progress.events.length)).toEqual(legacy.progress.events);
    expect((await rows(page)).media).toBe(0); // Opening the streaming player did not download it.
    for (const [kind, bad] of [['incomplete', original.subarray(0, original.length - 1)], ['checksum', Buffer.from(original)]] as const) {
      if (kind === 'checksum') bad[bad.length - 1] ^= 1;
      // Service-worker fetches bypass page routing. Inject only failed download
      // responses; native streaming and the eventual successful download are real HTTP.
      await page.evaluate(bytes => {
        (window as any).__realFetch = window.fetch;
        window.fetch = (input, options) => String(input).includes('/audio?')
          ? Promise.resolve(new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'audio/ogg' } }))
          : (window as any).__realFetch(input, options);
      }, [...bad]);
      await page.getByRole('button', { name: 'Download for offline use' }).click();
      await expect(page.getByRole('alert')).toContainText(kind);
      await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(0);
      expect((await rows(page)).media).toBe(0);
      await page.evaluate(() => { window.fetch = (window as any).__realFetch; });
    }
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put; (window as any).__failDownloadSave = true;
      IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) {
        if (this.name === 'media' && (window as any).__failDownloadSave) throw new DOMException('Simulated quota failure', 'QuotaExceededError');
        return put.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Download for offline use' }).click();
    await expect(page.getByRole('alert')).toContainText('Offline download did not complete');
    expect((await rows(page)).media).toBe(0);
    expect((await saved(page)).lesson.recording!.audio).toHaveProperty('mediaUrl');
    await page.evaluate(() => { (window as any).__failDownloadSave = false; });
    await page.getByRole('button', { name: 'Download for offline use' }).click();
    await expect(page.getByText('Download complete · teacher audio and all prepared visuals saved locally.')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
    expect(await page.locator('.download-status progress').getAttribute('value')).toBe(String(original.length));
    await expect(audio).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(recording.cues[4].offsetMs, -1);
    await page.screenshot({ path: info.outputPath('recorded-main-student-a.png'), fullPage: true });
    await lock(page);
    const downloadedA = await saved(page);
    await unlock(page, b, '222222'); await page.getByRole('button', { name: 'Watch Now', exact: true }).click();
    await expect(audio).toHaveAttribute('src', streamUrl);
    await expect(player.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id', 'light-path-steps');
    await assertWatermark(player.locator(':scope > .replay-stage'));
    await assertPlaybackMotion(audio, player.locator(':scope > .replay-stage'));
    await audio.evaluate((element: HTMLAudioElement) => element.play());
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(.3);
    await audio.evaluate((element: HTMLAudioElement, ms) => { element.pause(); element.currentTime = ms / 1000; }, recording.cues[4].offsetMs);
    await expect(player.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-steps');
    await assertWatermark(player.locator(':scope > .replay-stage'));
    await expect(player.locator(':scope > .replay-stage svg text').filter({ hasText: '1. Light approaches at an angle.' })).toHaveAttribute('font-weight', '800');
    await assertPlaybackMotion(audio, player.locator(':scope > .replay-stage'), recording.cues[1].offsetMs);
    await audio.evaluate((element: HTMLAudioElement, ms) => { element.currentTime = ms / 1000; }, recording.cues[4].offsetMs);
    let downloadedAgain = false;
    page.on('request', request => { if (request.resourceType() === 'fetch' && request.url().includes('/audio?')) downloadedAgain = true; });
    await page.getByRole('button', { name: 'Download for offline use' }).click();
    await expect(page.getByText('Download complete · teacher audio and all prepared visuals saved locally.')).toBeVisible({ timeout: 20000 });
    expect(downloadedAgain).toBe(false); expect((await rows(page)).media).toBe(1);
    await lock(page); const downloadedB = await saved(page, b, '222222');
    expect(downloadedB.progress.queuedQuestions).toHaveLength(0);
    expect(downloadedB.lesson.recording!.audio).toEqual(downloadedA.lesson.recording!.audio);
    expect(downloadedB.lesson.playback!.sequence).not.toEqual(downloadedA.lesson.playback!.sequence);
    expect(downloadedB.lesson.objective).toEqual(downloadedA.lesson.objective);
    expect(await saved(page)).toEqual(downloadedA);
    await context.addInitScript(() => {
      if (location.port !== '4273') return;
      (window as any).__schoolFetch = window.fetch.bind(window);
      (window as any).__networkAttempts = [];
      for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, { value: () => { (window as any).__networkAttempts.push(name); throw new Error('Downloaded learning must stay offline'); } });
    });
    await context.setOffline(true); await page.reload(); await unlock(page);
    await expect(audio).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(downloadedA.player.recording!.positionMs, -1);
    await audio.evaluate((element: HTMLAudioElement) => element.play());
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(downloadedA.player.recording!.positionMs / 1000 + .15);
    await assertPlaybackMotion(audio, player.locator(':scope > .replay-stage'));
    await assertPlaybackMotion(audio, player.locator(':scope > .replay-stage'), recording.cues[1].offsetMs);
    await audio.evaluate((element: HTMLAudioElement, ms) => { element.pause(); element.currentTime = ms / 1000 + .1; }, recording.cues[1].offsetMs);
    await page.setViewportSize({ width: 320, height: 900 });
    const visual = player.locator(':scope > .replay-stage');
    await assertWatermark(visual);
    await expect(visual.getByRole('img')).toHaveAccessibleDescription(/pencil stays straight/);
    await visual.getByText('Read visual annotations', { exact: true }).click();
    await expect(visual.locator('figcaption')).toContainText('Grey: the pencil stays straight.');
    const straightNote = visual.locator('figcaption').getByText('Grey: the pencil stays straight.', { exact: true });
    await expect(straightNote).toBeInViewport();
    expect(await page.getByRole('link', { name: 'Skip to content' }).evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    expect(await straightNote.evaluate(element => {
      const note = element.getBoundingClientRect(), canvas = element.closest('figure')!.getBoundingClientRect();
      return note.bottom <= canvas.bottom && note.top >= canvas.top;
    })).toBe(true);
    await page.screenshot({ path: info.outputPath('student-readable-visual-notes-320.png'), fullPage: true });
    expect(await visual.locator('figcaption').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    for (const control of ['Play lesson replay', 'Back 10 seconds', 'Forward 10 seconds', 'Expand lesson player']) {
      const bounds = await page.getByRole('button', { name: control, exact: true }).boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.width).toBeGreaterThanOrEqual(44);
    }
    expect((await page.getByLabel('Seek recorded lesson').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Expand lesson player' }).click();
    await expect(page.getByRole('button', { name: 'Exit expanded view' })).toBeVisible();
    await expect(straightNote).toBeInViewport();
    expect(await player.locator('.player-controls').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('student-expanded-readable-notes-320.png'), fullPage: true });
    await page.getByRole('button', { name: 'Exit expanded view' }).click();
    await visual.getByText('Read visual annotations', { exact: true }).click();
    const companionPending = await verifyCompanionConversation(page, recording, info, () => saved(page));
    await page.getByRole('button', { name: 'Talk with Coteacher' }).focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('region', { name: 'Coteacher lesson companion', exact: true });
    await expect(dialog).toBeVisible();
    await assertCompanionDock(page);
    await expect.poll(() => page.locator('[data-companion-audio]').evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    await page.getByText('Voice & connection', { exact: true }).click();
    await page.evaluate(() => Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }));
    await page.getByRole('button', { name: 'Hold to talk offline', exact: true }).press('Space');
    await expect(page.getByText('Offline voice is unavailable on this device. Please type your question.', { exact: true })).toBeVisible();
    await page.getByLabel('Which part of this recorded concept is unclear?').fill('Why does the pencil look broken?');
    await page.getByRole('button', { name: 'Ask Coteacher', exact: true }).click();
    await page.getByText('More ways to learn', { exact: true }).click();
    await page.getByRole('navigation', { name: 'Prepared concept representations' }).getByRole('button', { name: /step/i }).click();
    await expect(page.locator('.recorded-help')).toHaveAttribute('data-support-asset-id', 'refraction-steps');
    await expect(page.locator('.companion-dock')).toBeVisible();
    const pausedAt = await audio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000);
    await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
    await page.reload(); await unlock(page);
    expect((await saved(page)).progress.queuedQuestions.find(question => question.id === companionPending.id)).toEqual(companionPending);
    expect((await saved(page, b, '222222')).progress.queuedQuestions.some(question => question.id === companionPending.id)).toBe(false);
    await expect(page.locator('.recorded-help')).toHaveAttribute('data-support-asset-id', 'refraction-steps');
    await expect(page.locator('.companion-dock')).toBeVisible();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(pausedAt, -1);
    await page.getByText('More ways to learn', { exact: true }).click();
    await page.getByRole('button', { name: 'Quick check', exact: true }).click();
    await page.getByRole('button', { name: 'Light changes direction at the angled water-air boundary', exact: true }).click();
    await expect(page.locator('.quiz-card [role="status"]')).toContainText('You’ve got it');
    await page.getByRole('button', { name: 'Return to recorded lesson' }).click();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(pausedAt / 1000 + .15);
    await expect(page.locator('.companion-dock')).toBeHidden();
    await expect(player.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-pencil');
    await audio.evaluate((element: HTMLAudioElement) => element.pause()); await lock(page);
    const finalA = await saved(page); expect(finalA.progress.events.some(event => event.type === 'visual-explored')).toBe(true);
    expect((await saved(page, b, '222222')).progress.events.some(event => event.type === 'visual-explored')).toBe(false);
    await unlock(page, b, '222222');
    await page.getByRole('button', { name: 'Check this concept', exact: true }).click();
    await page.getByRole('button', { name: 'The water physically bends the pencil', exact: true }).click();
    await expect(page.getByText('Let’s try another way.', { exact: true })).toBeVisible();
    const checkPosition = await audio.evaluate((element: HTMLAudioElement) => element.currentTime);
    await page.keyboard.press('Escape');
    await expect(page.locator('.companion-dock')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Check this concept', exact: true })).toBeFocused();
    expect(await audio.evaluate((element: HTMLAudioElement, position) => element.paused && element.currentTime === position, checkPosition)).toBe(true);
    await lock(page);
    const offlineB = await saved(page, b, '222222');
    expect(offlineB.progress.events.some(event => event.type === 'quiz-answered' && !event.correctness)).toBe(true);
    expect((await saved(page)).progress).toEqual(finalA.progress);
    await page.close(); page = await context.newPage(); await page.goto('http://127.0.0.1:4273'); await unlock(page);
    const reopenedAudio = page.locator('.recorded-lesson audio');
    await expect.poll(() => reopenedAudio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(finalA.player.recording!.positionMs, -1);
    expect(await page.evaluate(() => (window as any).__networkAttempts)).toEqual([]);
    // Extend the same saved offline history, rather than creating a conflicting
    // fresh device for the same learner. Returning a malformed acknowledgement
    // must preserve the queue and must not claim successful synchronization.
    await page.getByRole('button', { name: 'I don’t understand' }).click();
    await page.getByLabel('Which part of this recorded concept is unclear?').fill('Should I use a glass cup for this activity?');
    await page.getByRole('button', { name: 'Ask Coteacher', exact: true }).click();
    await page.getByRole('button', { name: 'Return to recorded lesson' }).click();
    await reopenedAudio.evaluate((element: HTMLAudioElement) => element.pause());
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(page.locator('.profile-sync')).toContainText('waiting for connection');
    await expect.poll(async () => (await saved(page)).progress.queuedQuestions.some(question => !question.answered && /glass cup/.test(question.text))).toBe(true);
    const pendingA = await saved(page);
    expect(pendingA.progress.events.every(event => Boolean(event.eventId))).toBe(true);
    expect(new Set(pendingA.progress.events.map(event => event.eventId)).size).toBe(pendingA.progress.events.length);
    await page.evaluate(() => { window.fetch = (input, options) => String(input).includes('/api/progress/') && options?.method === 'POST' ? Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) : (window as any).__schoolFetch(input, options); });
    await context.setOffline(false);
    // Chromium emulation resets navigator.onLine after a cached navigation.
    // Emit the genuine reconnect signal after restoring network transport;
    // every synchronization response still comes from the actual HTTP service.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.profile-sync')).toContainText('school sync unavailable', { timeout: 15000 });
    expect((await saved(page)).progress.queuedQuestions).toEqual(pendingA.progress.queuedQuestions);
    expect((await saved(page)).sync?.questionIds ?? []).not.toContain(pendingA.progress.queuedQuestions.at(-1)!.id);
    // Hold real HTTP receipts while the learner adds more offline-origin work.
    // The service receives normally; only delivery of its response is delayed.
    await page.evaluate(() => {
      (window as any).__receiptHolds = [];
      window.fetch = async (input, options) => {
        const response = await (window as any).__schoolFetch(input, options);
        if (String(input).includes('/api/progress/') && options?.method === 'POST') {
          await new Promise<void>(resolve => (window as any).__receiptHolds.push(resolve));
        }
        return response;
      };
    });
    await page.getByRole('button', { name: 'Try school sync' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__receiptHolds.length), { timeout: 15000 }).toBe(1);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Continue Watching', exact: true }).click();
    await page.getByRole('button', { name: 'I don’t understand' }).click();
    await page.getByLabel('Which part of this recorded concept is unclear?').fill('Will this water glow in the dark?');
    await page.getByRole('button', { name: 'Ask Coteacher', exact: true }).click();
    await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
    const newerA = await saved(page);
    expect(newerA.progress.events.length).toBeGreaterThan(pendingA.progress.events.length);
    await page.getByRole('button', { name: 'Close learning panel' }).click();
    await page.evaluate(() => (window as any).__receiptHolds.shift()());
    await expect.poll(async () => (await saved(page)).sync?.questionIds).toEqual(pendingA.progress.queuedQuestions.map(question => question.id));
    const partialA = await saved(page);
    expect(partialA.progress.events).toEqual(newerA.progress.events);
    expect(partialA.progress.queuedQuestions).toEqual(newerA.progress.queuedQuestions);
    expect(partialA.sync!.eventIds).toEqual(pendingA.progress.events.map(event => event.eventId));
    await expect.poll(() => page.evaluate(() => (window as any).__receiptHolds.length), { timeout: 15000 }).toBe(1);
    await page.evaluate(() => { window.fetch = (window as any).__schoolFetch; (window as any).__receiptHolds.shift()(); });
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(page.locator('.profile-sync')).toContainText('school received your progress', { timeout: 20000 });
    const receivedA = await saved(page);
    expect(receivedA.sync!.eventIds).toEqual(receivedA.progress.events.map(event => event.eventId));
    expect(receivedA.sync!.questionIds).toEqual(receivedA.progress.queuedQuestions.map(question => question.id));
    await page.getByRole('button', { name: 'Try school sync' }).click();
    await expect(page.locator('.profile-sync')).toContainText('school received your progress', { timeout: 20000 });
    expect((await saved(page)).progress.events).toEqual(receivedA.progress.events);
    await lock(page); await unlock(page, b, '222222');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Try school sync' }).click();
    await expect(page.locator('.profile-sync')).toContainText('school received your progress', { timeout: 20000 });
    expect((await saved(page, b, '222222')).progress.queuedQuestions).toHaveLength(0);
    const receivedB = await saved(page, b, '222222');
    expect(receivedB.progress).toEqual(offlineB.progress);
    expect(receivedB.sync!.receipt.studentId).toBe(b);
    expect(receivedB.sync!.eventIds).toEqual(receivedB.progress.events.map(event => event.eventId));
    if (teacher) {
      await teacher.getByRole('button', { name: 'Sync & Transfers', exact: true }).click();
      await teacher.getByRole('button', { name: 'Check school connection' }).click();
      await expect(teacher.getByText('School connection checked · received learning records saved.')).toBeVisible();
      await teacher.getByRole('button', { name: 'Class insights', exact: true }).click();
      await expect(teacher.locator('.insight-summary article').nth(1)).toContainText('2');
      await teacher.getByLabel('Learning records').selectOption('received');
      await teacher.locator('.heat-row[data-concept-id=refraction] button').click();
      await expect(teacher.locator('.heat-row[data-concept-id=refraction]')).toContainText('2 / 2 learners with support signals');
      await expect(teacher.locator('.heat-row[data-concept-id=refraction]')).toContainText('1 incorrect checks');
      await teacher.locator('.contributing-events summary').first().click();
      await expect(teacher.locator('.contributing-events')).toContainText('Should I use a glass cup for this activity?');
      await expect(teacher.locator('.insight-context')).toContainText('Recorded classroom appearances:');
      await expect(teacher.locator('.insight-visuals')).toContainText('explicit explorations');
      await teacher.locator('.insight-visuals summary').first().click();
      await expect(teacher.locator('.insight-visuals [data-visual-asset-id=refraction-pencil]')).toBeVisible();
      await teacher.getByLabel('Learning records').selectOption('seeded');
      await expect(teacher.getByText('4 / 18 learners with support signals')).toBeVisible();
      const originalPreparation = await teacher.evaluate(() => localStorage.getItem('coteacher-teacher-preparation-v1'));
      await teacher.getByRole('button', { name: 'Review this activity', exact: true }).click();
      await expect(teacher.locator('[data-variant-id=refraction-tryit]')).toHaveAttribute('open', '');
      expect(await teacher.evaluate(() => localStorage.getItem('coteacher-teacher-preparation-v1'))).toBe(originalPreparation);
      await teacher.getByRole('button', { name: 'Questions', exact: true }).click();
      await expect(teacher.locator('.question-inbox')).toContainText('glass cup');
      await expect(teacher.locator('.question-inbox')).toContainText('Refraction at the water surface');
      await teacher.getByRole('button', { name: 'Needs review', exact: true }).click();
      await teacher.getByLabel('Lesson concept', { exact: true }).selectOption('refraction');
      const pendingRefraction = receivedA.progress.queuedQuestions.filter(question => !question.answered &&
        (question.recordedContext?.conceptId ?? receivedA.lesson.timeline.find(step => step.id === question.timelineStepId)?.conceptId) === 'refraction');
      await expect(teacher.locator('.question-inbox article')).toHaveCount(pendingRefraction.length);
      await teacher.getByRole('button', { name: 'Open this concept' }).first().click();
      await expect(teacher.locator('.cue')).toHaveAttribute('data-presentation-concept-id', 'refraction');
      await teacher.getByRole('button', { name: 'Sync & Transfers', exact: true }).click();
      await teacher.getByText('Review imported queued questions', { exact: true }).click();
      await teacher.getByRole('button', { name: 'Review Student A questions', exact: true }).click();
      await teacher.getByRole('button', { name: 'Run simulated answer return' }).click();
      await teacher.getByRole('button', { name: 'Return reviewed answers through school service' }).click();
      await expect(teacher.getByText('Reviewed prepared answers saved by the school service. This learner will receive them on their next sync.')).toBeVisible();
      await teacher.reload();
      await teacher.getByText('Review imported queued questions', { exact: true }).click();
      await expect(teacher.getByRole('button', { name: 'Review Student A questions', exact: true })).toBeVisible();
      await teacher.getByRole('button', { name: 'Class insights', exact: true }).click();
      await expect(teacher.locator('.insight-summary article').nth(1)).toContainText('2');
      await teacher.getByRole('button', { name: 'Questions', exact: true }).click();
      await teacher.getByRole('button', { name: 'Answered', exact: true }).click();
      await expect(teacher.locator('.question-inbox')).toContainText('plastic cup');
    }
    await lock(page); await unlock(page);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Try school sync' }).click();
    await expect(page.locator('.profile-sync')).toContainText('school received your progress', { timeout: 20000 });
    if (teacher) {
      await expect.poll(async () => (await saved(page)).progress.queuedQuestions.some(question => question.answered && question.answer.includes('plastic cup')), { timeout: 20000 }).toBe(true);
      expect((await saved(page, b, '222222')).progress.queuedQuestions).toHaveLength(0);
      const returnedA = await saved(page);
      const answer = returnedA.progress.queuedQuestions.find(question => question.answered && question.answer.includes('plastic cup'))!;
      expect(answer).toMatchObject({ answerOrigin: 'simulated-prepared', recordedContext: pendingA.progress.queuedQuestions.at(-1)!.recordedContext });
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
      await page.getByRole('button', { name: 'Continue Watching', exact: true }).click();
      await page.getByRole('button', { name: 'Your questions', exact: true }).click();
      await expect(page.locator('.player-questions')).toContainText('Answered · prepared demo response');
      await expect(page.locator('.player-questions')).toContainText('Use a clear plastic cup, never glass.');
      await page.getByRole('button', { name: 'Close learning panel' }).click();
      await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
      const beforeOffline = await saved(page);
      await context.setOffline(true); await page.close(); page = await context.newPage();
      await page.goto('http://127.0.0.1:4273'); await unlock(page);
      expect((await saved(page)).sync).toEqual(beforeOffline.sync);
      await page.getByRole('button', { name: 'Your questions', exact: true }).click();
      await expect(page.locator('.player-questions')).toContainText('Answered · prepared demo response');
      const offlineA = await saved(page);
      expect(offlineA.progress.events.slice(0, receivedA.progress.events.length)).toEqual(receivedA.progress.events);
      expect(offlineA.progress.queuedQuestions.find(question => question.id === answer.id)).toEqual(answer);
      expect((await saved(page, b, '222222')).progress).toEqual(receivedB.progress);
      expect((await saved(page, b, '222222')).sync).toEqual(receivedB.sync);
      expect(await page.evaluate(() => (window as any).__networkAttempts)).toEqual([]);
    }
    expect((await saved(page)).progress.events.slice(0, pendingA.progress.events.length)).toEqual(pendingA.progress.events);
  } finally { await context.close(); }
}
