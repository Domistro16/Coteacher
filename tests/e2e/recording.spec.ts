import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decryptPayload, encryptPayload, requirePublishedLesson, type LessonRecording } from '@coteacher/shared';

// Native browser microphone graph with Chromium's simulated input. No real people.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

async function prepare(page: Page) {
  await page.goto('http://127.0.0.1:4274');
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await page.getByRole('button', { name: 'Start presentation' }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
}
async function savedRecording(page: Page): Promise<LessonRecording> {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const open = indexedDB.open('coteacher-teacher-recordings', 1);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('recordings').objectStore('recordings').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result[0]); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
    open.onerror = () => reject(open.error);
  }));
}

test('native microphone capture excludes pauses, persists cues and replays exact visuals in both personal offline packages', async ({ page, context }, info) => {
  test.setTimeout(150_000);
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4274' });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      Object.defineProperty(window, '__teacherStream', { value: stream, configurable: true });
      return stream;
    };
    Object.defineProperty(window, 'SpeechRecognition', { value: () => { throw new Error('No transcription permitted'); } });
  });
  await prepare(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('button', { name: 'Start audio recording' })).toBeDisabled();
  const prepared = await page.evaluate(() => JSON.parse(localStorage.getItem('coteacher-teacher-preparation-v1')!).drafts);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare lesson', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Expand projector view' }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Next visual' }).click();
  expect(await page.getByRole('navigation', { name: 'Presentation controls' }).evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await page.screenshot({ path: info.outputPath('projector-live-recording.png'), fullPage: true });
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Pause recording', exact: true }).click();
  await expect(page.getByText('Recording paused · microphone muted', { exact: false })).toBeVisible();
  const pausedStatus = await page.locator('.recording-status').innerText();
  expect(await page.evaluate(() => (window as any).__teacherStream.getAudioTracks()[0].enabled)).toBe(false);
  await page.getByRole('button', { name: 'Previous visual' }).click();
  await page.waitForTimeout(2300);
  expect(await page.locator('.recording-status').innerText()).toBe(pausedStatus);
  await page.getByRole('button', { name: 'Resume recording', exact: true }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__teacherStream.getAudioTracks()[0].enabled)).toBe(true);
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Next visual' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit projector view' }).click();
  expect(await page.evaluate(() => (window as any).__teacherStream.getAudioTracks()[0].readyState)).toBe('ended');
  const recording = await savedRecording(page);
  expect(recording.review.status).toBe('draft');
  expect(recording.durationMs).toBeGreaterThan(5000);
  expect(recording.durationMs).toBeLessThan(8000);
  expect(recording.cues.map(cue => cue.timelineStepId)).toEqual(['step-light', 'step-refraction', 'step-light', 'step-light', 'step-refraction']);
  expect(recording.cues[2].offsetMs).toBe(recording.cues[3].offsetMs);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('coteacher-teacher-preparation-v1')!).drafts);
  for (let i = 0; i < stored.length; i++) {
    const { classroomTimeline, ...content } = stored[i];
    const { classroomTimeline: previous, ...before } = prepared[i];
    expect(content).toEqual(before);
  }
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export Student A package' })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible();
  expect(await savedRecording(page)).toEqual(recording);
  const playback = page.locator('.recorded-lesson');
  const audio = playback.locator('audio');
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.duration)).toBeCloseTo(recording.durationMs / 1000, 1);
  await page.getByLabel('I reviewed the audio and visual timing', { exact: false }).check();
  await expect(page.getByRole('button', { name: 'Approve recording for learners' })).toBeDisabled();
  await audio.evaluate((element: HTMLAudioElement) => element.play());
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(recording.cues[1].offsetMs / 1000 + .15);
  await expect(playback).toHaveAttribute('data-recorded-step-id', 'step-refraction');
  await audio.evaluate((element: HTMLAudioElement) => element.pause());
  await playback.locator('[data-recorded-cue-index="0"]').click();
  await expect(playback).toHaveAttribute('data-recorded-step-id', 'step-light');
  await playback.locator('[data-recorded-cue-index="4"]').click();
  await expect(playback).toHaveAttribute('data-recorded-concept-id', 'refraction');
  await page.screenshot({ path: info.outputPath('teacher-recording-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Approve recording for learners' }).click();
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export Student A package' })).toBeDisabled();
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await page.getByLabel('I reviewed both personalized visual sequences', { exact: false }).check();
  await page.getByRole('button', { name: 'Approve personalized playback' }).click();
  await expect(page.getByText('Both personalized visual sequences approved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Recording reviewed · ready for export', { exact: true })).toBeVisible();
  const approvedRecording = await savedRecording(page);
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  const paths: string[] = [];
  for (const [label, pin] of [['Student A', '111111'], ['Student B', '222222']]) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: `Export ${label} package` }).click();
    const path = (await (await download).path())!; paths.push(path);
    const lesson = requirePublishedLesson(await decryptPayload(JSON.parse(await readFile(path, 'utf8')), pin));
    expect(lesson.recording).toEqual(approvedRecording);
    expect(lesson.objective).toEqual(prepared[0].objective);
  }
  await page.addInitScript(() => {
    if (location.port !== '4273') return;
    const put = IDBObjectStore.prototype.put;
    Object.defineProperty(window, '__failMediaSave', { value: false, writable: true });
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) {
      if (this.name === 'media' && (window as any).__failMediaSave) throw new DOMException('Simulated media quota failure', 'QuotaExceededError');
      return put.apply(this, args);
    };
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, {
      value: () => { throw new Error('Recorded learner core path attempted networking'); },
    });
  });
  await page.goto('http://127.0.0.1:4273');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  const approvedPayload = requirePublishedLesson(await decryptPayload(JSON.parse(await readFile(paths[0], 'utf8')), '111111'));
  const bPayload = requirePublishedLesson(await decryptPayload(JSON.parse(await readFile(paths[1], 'utf8')), '222222'));
  expect(bPayload.recording).toEqual(approvedPayload.recording);
  expect(bPayload.visualAssets).not.toEqual(approvedPayload.visualAssets);
  expect(bPayload.playback!.sequence.map(item => item.visualAssetId)).not.toEqual(approvedPayload.playback!.sequence.map(item => item.visualAssetId));
  const draftPayload = await encryptPayload({ ...approvedPayload, recording }, '111111');
  await page.getByLabel('Import lesson file').setInputFiles({ name: 'unreviewed-recording.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draftPayload)) });
  await expect(page.getByRole('alert')).toContainText('Review and approve the classroom recording');
  await expect(page.locator('.recorded-lesson')).toHaveCount(0);
  const visualDraft = await encryptPayload({ ...approvedPayload, recording: { ...approvedPayload.recording, visualReview: { status: 'draft' } } }, '111111');
  await page.getByLabel('Import lesson file').setInputFiles({ name: 'unreviewed-visuals.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(visualDraft)) });
  await expect(page.getByRole('alert')).toContainText('personalized visual sequences');
  const missingAsset = { ...approvedPayload, visualAssets: approvedPayload.visualAssets!.slice(0, 1) };
  await page.getByLabel('Import lesson file').setInputFiles({ name: 'missing-visual.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(await encryptPayload(missingAsset, '111111'))) });
  await expect(page.getByRole('alert')).toContainText('incomplete or damaged');
  await expect(page.locator('.recorded-lesson')).toHaveCount(0);
  await page.evaluate(() => { (window as any).__failMediaSave = true; });
  await page.getByLabel('Import lesson file').setInputFiles(paths[0]);
  await expect(page.getByRole('alert')).toContainText('Complete lesson media could not be saved');
  await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(0);
  const failedCounts = await page.evaluate(() => new Promise<any>(resolve => {
    const request = indexedDB.open('coteacher-sprint'); request.onsuccess = () => {
      const db = request.result, tx = db.transaction(['profiles', 'media']);
      const profiles = tx.objectStore('profiles').count(), media = tx.objectStore('media').count();
      tx.oncomplete = () => { db.close(); resolve([profiles.result, media.result]); };
    };
  }));
  expect(failedCounts).toEqual([0, 0]);
  await page.evaluate(() => { (window as any).__failMediaSave = false; });
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const onlineAudio = page.locator('.recorded-lesson audio');
  await onlineAudio.evaluate((element: HTMLAudioElement) => element.play());
  await expect.poll(() => onlineAudio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(.3);
  await onlineAudio.evaluate((element: HTMLAudioElement) => element.pause());
  const aPosition = recording.cues[4].offsetMs + 100;
  await onlineAudio.evaluate((element: HTMLAudioElement, ms) => { element.currentTime = ms / 1000; }, aPosition);
  await expect(page.locator('.replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-pencil');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await page.getByLabel('Your profile', { exact: true }).selectOption('student-b1c2d3e4');
  await page.getByLabel('Six-digit PIN').fill('222222');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await page.getByLabel('Import lesson file').setInputFiles(paths[0]);
  await expect(page.getByRole('alert')).toContainText('PIN');
  await page.getByLabel('Import lesson file').setInputFiles(paths[1]);
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
  await expect(page.locator('.replay-stage')).toHaveAttribute('data-visual-asset-id', 'light-path-steps');
  await page.locator('.recorded-lesson').getByRole('button', { name: 'Play lesson replay' }).click();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(.3);
  await page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => { element.pause(); element.currentTime = 1.2; });
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  const mediaState = await page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('coteacher-sprint');
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction(['profiles', 'media']);
      const profiles = tx.objectStore('profiles').getAll(); const media = tx.objectStore('media').count();
      tx.oncomplete = () => { db.close(); resolve({ profiles: profiles.result, mediaCount: media.result }); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  expect(mediaState.mediaCount).toBe(1);
  const storedA = await decryptPayload(mediaState.profiles[0], '111111') as any;
  const storedB = await decryptPayload(mediaState.profiles[1], '222222') as any;
  expect(storedA.lesson.recording.audio.dataBase64).toBeUndefined();
  expect(storedA.lesson.recording.audio.mediaId).toBe(storedB.lesson.recording.audio.mediaId);
  expect(storedA.player.recording.positionMs).toBeCloseTo(aPosition, -1);
  expect(storedB.player.recording.positionMs).toBeCloseTo(1200, -1);
  await page.screenshot({ path: info.outputPath('student-b-ordered-visual.png'), fullPage: true });
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await page.getByLabel('Your profile', { exact: true }).selectOption('student-a1b2c3d4');
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  const studentPlayback = page.locator('.recorded-lesson');
  await expect(studentPlayback).toHaveAttribute('data-recorded-lesson-id', prepared[0].lessonId);
  const studentAudio = studentPlayback.locator('audio');
  await expect.poll(() => studentAudio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(aPosition, -1);
  await expect(page.locator('.replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-pencil');
  expect(await studentAudio.getAttribute('src')).toMatch(/^blob:/);
  await expect.poll(() => studentAudio.evaluate((element: HTMLAudioElement) => element.duration)).toBeCloseTo(recording.durationMs / 1000, 1);
  await studentAudio.evaluate((element: HTMLAudioElement) => element.play());
  await expect.poll(() => studentAudio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(aPosition / 1000 + .15);
  await studentAudio.evaluate((element: HTMLAudioElement) => element.pause());
  await studentPlayback.getByText('Recorded visual timeline', { exact: true }).click();
  await studentPlayback.locator('[data-recorded-cue-index="4"]').click();
  await expect(studentPlayback).toHaveAttribute('data-recorded-step-id', 'step-refraction');
  await studentPlayback.getByRole('button', { name: 'Study this exact concept' }).click();
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-step-id', 'step-refraction');
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-concept-id', 'refraction');
  await expect(page.locator('.teacher-words')).toHaveJSProperty('open', true);
  await page.screenshot({ path: info.outputPath('offline-recorded-concept.png'), fullPage: true });
  await studentPlayback.getByRole('button', { name: 'Pause and explain this concept' }).click();
  await expect(page.locator('.help-response')).toBeVisible();
  await expect(page.locator('.help-response')).toContainText('Lesson moment:');
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-step-id', 'step-refraction');
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  await page.getByRole('button', { name: 'Start activity' }).click();
  await expect(page.locator('.instruction')).toBeVisible();
  await page.getByRole('button', { name: 'Take my quiz' }).click();
  await page.locator('.quiz-options button').first().click();
  await page.getByLabel('Type your question').fill('What does the Moon taste like?');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your saved questions' })).toBeVisible();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(recording.cues[4].offsetMs, -1);
  await expect(page.getByRole('heading', { name: 'Your saved questions' })).toBeVisible();
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await page.getByLabel('Your profile', { exact: true }).selectOption('student-b1c2d3e4');
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect(page.getByRole('alert')).toContainText('PIN');
  await page.getByLabel('Six-digit PIN').fill('222222');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeCloseTo(1.2, 2);
  await expect(page.getByRole('heading', { name: 'Your saved questions' })).toHaveCount(0);
  await page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement, ms) => { element.currentTime = ms / 1000; }, recording.cues[4].offsetMs);
  await expect(page.locator('.replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-steps');
  await page.locator('.recorded-lesson').getByRole('button', { name: 'Play lesson replay' }).click();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(recording.cues[4].offsetMs / 1000 + .15);
  await page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.pause());
  await page.screenshot({ path: info.outputPath('student-b-offline-refraction.png'), fullPage: true });
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await page.evaluate(() => new Promise<void>(resolve => {
    const request = indexedDB.open('coteacher-sprint'); request.onsuccess = () => {
      const db = request.result, tx = db.transaction('media', 'readwrite'); tx.objectStore('media').clear();
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  await page.reload();
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect(page.getByRole('alert')).toContainText('Recorded audio is missing');
  await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(0);
  await expect(page.locator('.recorded-lesson')).toHaveCount(0);
  await page.getByLabel('Recollect recorded package').setInputFiles(paths[0]);
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Your saved questions' })).toBeVisible();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(recording.cues[4].offsetMs, -1);
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await page.evaluate(() => new Promise<void>(resolve => {
    const request = indexedDB.open('coteacher-sprint'); request.onsuccess = () => {
      const db = request.result, tx = db.transaction('media', 'readwrite'), store = tx.objectStore('media');
      const keys = store.getAllKeys(); keys.onsuccess = () => store.put({ iv: new Uint8Array(12), ciphertext: new ArrayBuffer(1) }, keys.result[0]);
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  await page.reload();
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await expect(page.getByRole('alert')).toContainText('incomplete or damaged');
  await expect(page.getByText('Ready offline', { exact: true })).toHaveCount(0);
  await page.getByLabel('Recollect recorded package').setInputFiles(paths[0]);
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Your saved questions' })).toBeVisible();
});

test('microphone permission failure leaves manual presentation available and never claims a recording', async ({ page, context }) => {
  await context.grantPermissions([], { origin: 'http://127.0.0.1:4274' });
  // Fake permission dialogs auto-allow; explicitly exercise the native rejection shape.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Simulated permission denial', 'NotAllowedError'); };
  });
  await prepare(page);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was denied');
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  expect(await savedRecording(page)).toBeUndefined();
});

test('failed audio save retains replayable media, blocks navigation/export, and retries the complete draft', async ({ page, context }) => {
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4274' });
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    Object.defineProperty(window, '__failAudioSave', { value: true, writable: true });
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) {
      if (this.name === 'recordings' && (window as any).__failAudioSave) throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await prepare(page);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(page.getByText('Recording not saved · keep this tab open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare lesson', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve recording for learners' })).toBeDisabled();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.duration)).toBeGreaterThan(1);
  await page.evaluate(() => { (window as any).__failAudioSave = false; });
  await page.getByRole('button', { name: 'Retry saving recording' }).click();
  await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible();
  expect((await savedRecording(page)).review.status).toBe('draft');
});

test('canceling a pending permission request releases a subsequently granted microphone without recording', async ({ page, context }) => {
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4274' });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = constraints => new Promise(resolve => {
      Object.defineProperty(window, '__grantLater', { configurable: true, value: async () => {
        const stream = await original(constraints);
        Object.defineProperty(window, '__lateStream', { value: stream }); resolve(stream);
      } });
    });
  });
  await prepare(page);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Waiting for microphone permission…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next visual' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel microphone request' }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await page.evaluate(async () => { await (window as any).__grantLater(); });
  await expect.poll(() => page.evaluate(() => (window as any).__lateStream.getAudioTracks()[0].readyState)).toBe('ended');
  expect(await savedRecording(page)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Next visual' })).toBeEnabled();
});
