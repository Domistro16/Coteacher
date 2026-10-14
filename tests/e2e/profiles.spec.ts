import { openPreparedCompatibility } from './compatibility';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { cueForStep, decryptPayload, demoLessons, encryptPayload, reviewRecording, startPresentation, type EncryptedTransfer, type LessonRecording } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';

const a = 'student-a1b2c3d4', b = 'student-b1c2d3e4';
const questionA = 'Can the Moon taste like orange juice?';
const questionB = 'Why are clouds shaped like elephants?';
async function unlock(page: Page, id: string, pin: string) {
  await page.getByLabel('Your profile', { exact: true }).selectOption(id);
  await page.getByLabel('Six-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
}
async function rows(page: Page): Promise<{ keys: string[]; values: EncryptedTransfer[] }> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('coteacher-sprint');
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('profiles'), store = tx.objectStore('profiles');
      const keys = store.getAllKeys(), values = store.getAll();
      tx.oncomplete = () => { db.close(); resolve({ keys: keys.result as string[], values: values.result }); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  }));
}
async function saved(page: Page, id: string, pin: string): Promise<Snapshot> {
  const stored = await rows(page);
  return await decryptPayload(stored.values[stored.keys.indexOf(id)], pin) as Snapshot;
}
async function putRow(page: Page, id: string, value: EncryptedTransfer) {
  await page.evaluate(({ id, value }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('coteacher-sprint');
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('profiles', 'readwrite');
      tx.objectStore('profiles').put(value, id);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { id, value });
}
async function ask(page: Page, question: string) {
  await page.getByLabel('Type your question').fill(question);
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.locator('.queued')).toContainText(question);
}
async function lock(page: Page) {
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  // The click starts async save/lock; the welcome screen signals completion.
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
}
async function offline(page: Page, context: BrowserContext) {
  await context.addInitScript(() => {
    (window as any).__networkAttempts = [];
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, {
      value: () => { (window as any).__networkAttempts.push(name); throw new Error('Shared-device learning must remain offline'); },
    });
  });
  await page.goto('/'); await unlock(page, a, '111111');
  await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.getByText('Prepared-content demo ready offline', { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller ? undefined : new Promise<void>(resolve => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
  })));
  await context.setOffline(true);
}

test('two learners retain exact activity positions, private questions and different quiz histories through offline switching and reopening', async ({ page, context }) => {
  test.setTimeout(90_000);
  await offline(page, context);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await ask(page, questionA);
  await page.getByRole('button', { name: 'Take my quiz' }).click();
  await page.getByRole('button', { name: 'Light changes direction at the angled water-air boundary', exact: true }).click();
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  await page.getByRole('button', { name: 'Start activity' }).click();
  await page.getByRole('button', { name: 'Next instruction' }).click();
  const instructionA = await page.locator('.instruction').innerText();
  await page.getByLabel('Type your question').fill('Unsent private draft for A');
  // Lock must flush pending saves; do not wait for the last activity checkpoint.
  await lock(page);
  await expect(page.locator('.queued')).toHaveCount(0);
  await expect(page.locator('.lesson-step')).toHaveCount(0);
  await expect(page.getByLabel('Six-digit PIN')).toHaveValue('');
  const beforeA = await saved(page, a, '111111');
  expect(beforeA.player).toMatchObject({ timelineIndex: 1, variantId: 'refraction-tryit', activity: { phase: 'steps', instructionIndex: 1 } });
  expect(beforeA.progress.queuedQuestions.map(entry => entry.text)).toEqual([questionA]);
  expect(beforeA.progress.events.filter(entry => entry.type === 'quiz-answered')).toMatchObject([{ correctness: true }]);

  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByLabel('Your profile', { exact: true }).selectOption(b);
  await expect(page.getByLabel('Six-digit PIN')).toHaveValue('');
  await unlock(page, b, '111111');
  await expect(page.getByRole('alert')).toContainText('PIN');
  await expect(page.locator('.lesson-step')).toHaveCount(0);
  await unlock(page, b, '222222');
  // B's route uses the same lesson already cached on this device, with no download.
  await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.getByText('Prepared-content demo ready offline', { exact: true })).toBeVisible();
  await expect(page.locator('.queued')).toHaveCount(0);
  await expect(page.getByLabel('Type your question')).toHaveValue('');
  await page.getByRole('button', { name: 'Take my quiz' }).click();
  await expect(page.locator('.quiz-card [role="status"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await expect(page.locator('article[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-stepwise');
  await ask(page, questionB);
  await expect(page.locator('.queued')).not.toContainText(questionA);
  await page.getByRole('button', { name: 'The water physically bends the pencil', exact: true }).click();
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  await page.getByRole('button', { name: 'Start activity' }).click();
  const instructionB = await page.locator('.instruction').innerText();
  expect(instructionB).not.toBe(instructionA);
  await lock(page);
  const beforeB = await saved(page, b, '222222');
  expect(beforeB.lesson.lessonId).toBe(beforeA.lesson.lessonId);
  expect(beforeB.lesson.objective).toEqual(beforeA.lesson.objective);
  expect(beforeB.lesson.route).not.toEqual(beforeA.lesson.route);
  expect(beforeB.player.activity).toEqual({ phase: 'steps', instructionIndex: 0 });
  expect(beforeB.progress.queuedQuestions.map(entry => entry.text)).toEqual([questionB]);
  expect(beforeB.progress.events.filter(entry => entry.type === 'quiz-answered')).toMatchObject([{ correctness: false }]);
  expect(await saved(page, a, '111111')).toEqual(beforeA);
  const stored = await rows(page);
  expect(stored.keys).toEqual([a, b]);
  for (const value of stored.values) {
    expect(Object.keys(value).sort()).toEqual(['algorithm', 'ciphertext', 'iterations', 'iv', 'salt', 'schemaVersion']);
    expect(JSON.stringify(value)).not.toContain(questionA); expect(JSON.stringify(value)).not.toContain(questionB);
  }
  expect(stored.values[0].salt).not.toBe(stored.values[1].salt);
  await expect(decryptPayload(stored.values[0], '222222')).rejects.toThrow('PIN');
  await expect(decryptPayload(stored.values[1], '111111')).rejects.toThrow('PIN');
  // The device may retain a non-sensitive connection hint across an offline
  // reopening. Learner records and PINs must remain in encrypted IndexedDB.
  expect(await page.evaluate(() => ({ local: Object.entries(localStorage), session: sessionStorage.length })))
    .toEqual({ local: [['coteacher-school-offline', 'true']], session: 0 });
  expect(JSON.stringify(beforeA)).not.toContain('"pin"'); expect(JSON.stringify(beforeB)).not.toContain('"pin"');

  await page.reload();
  await unlock(page, a, '222222');
  await expect(page.getByRole('alert')).toContainText('PIN');
  await expect(page.locator('.lesson-step')).toHaveCount(0);
  await unlock(page, a, '111111');
  await expect(page.locator('.instruction')).toHaveText(instructionA);
  await expect(page.locator('.queued')).toContainText(questionA);
  await expect(page.locator('.queued')).not.toContainText(questionB);
  await page.getByRole('button', { name: 'Take my quiz' }).click();
  await expect(page.locator('.quiz-card [role="status"]')).toContainText('You’ve got it');
  expect((await saved(page, a, '111111')).progress).toEqual(beforeA.progress);
  await lock(page);
  await page.close();
  const reopened = await context.newPage(); await reopened.goto('/');
  await expect(reopened.locator('.lesson-step')).toHaveCount(0);
  await unlock(reopened, b, '222222');
  await expect(reopened.locator('.instruction')).toHaveText(instructionB);
  await expect(reopened.locator('.queued')).toContainText(questionB);
  await expect(reopened.locator('.queued')).not.toContainText(questionA);
  await reopened.getByRole('button', { name: 'Take my quiz' }).click();
  await expect(reopened.locator('.quiz-card [role="status"]')).toContainText('Let’s look at why');
  expect((await saved(reopened, b, '222222')).progress).toEqual(beforeB.progress);
  expect(await reopened.evaluate(() => (window as any).__networkAttempts)).toEqual([]);
});

test('foreign encrypted rows cannot open a learner session and changing profiles clears authenticated media recovery', async ({ page, context }) => {
  test.setTimeout(60_000);
  await offline(page, context);
  await lock(page);
  const snapshot = await saved(page, a, '111111');
  await putRow(page, b, await encryptPayload(snapshot, '222222'));
  await unlock(page, b, '222222');
  await expect(page.getByRole('alert')).toContainText('Saved profile is invalid');
  await expect(page.locator('.lesson-step')).toHaveCount(0);
  expect(await saved(page, a, '111111')).toEqual(snapshot);

  const lesson = startPresentation(demoLessons()[0], 'step-light', '2026-10-09T10:00:00Z', 'missing-media-session');
  const recording: LessonRecording = { id: 'missing-media-recording', lessonId: lesson.lessonId,
    classroomSessionId: lesson.classroomTimeline!.sessionId, lessonApprovedAt: lesson.classroomTimeline!.approvedAt,
    startedAt: '2026-10-09T10:00:01Z', durationMs: 1000, origin: 'teacher-microphone',
    audio: { mimeType: 'audio/wav', sampleRate: 16000, channels: 1, mediaKey: btoa(String.fromCharCode(...new Uint8Array(32))),
      mediaId: 'missing-local-audio', byteLength: 32044 },
    cues: [cueForStep(lesson, 'step-light', 0), cueForStep(lesson, 'step-refraction', 500)], review: { status: 'draft' } };
  await putRow(page, a, await encryptPayload({ ...snapshot, lesson: { ...lesson, recording: reviewRecording(recording, true, '2026-10-09T10:00:03Z') } }, '111111'));
  await unlock(page, a, '111111');
  await expect(page.getByLabel('Recollect recorded package')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Recorded audio is missing');
  await page.getByLabel('Your profile', { exact: true }).selectOption(b);
  await expect(page.getByLabel('Six-digit PIN')).toHaveValue('');
  await expect(page.getByLabel('Recollect recorded package')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.lesson-step')).toHaveCount(0);
  await page.getByLabel('Your profile', { exact: true }).selectOption(a);
  await expect(page.getByLabel('Recollect recorded package')).toHaveCount(0);
  await page.getByLabel('Six-digit PIN').fill('222222');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
  await expect(page.getByRole('alert')).toContainText('PIN');
  await expect(page.getByLabel('Recollect recorded package')).toHaveCount(0);
});
