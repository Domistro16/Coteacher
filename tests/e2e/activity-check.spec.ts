import { openPreparedCompatibility } from './compatibility';
import { expect, test, type Page } from '@playwright/test';
import { decryptPayload, demoLessons, type TryItVariant } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';

const a = 'student-a1b2c3d4', b = 'student-b1c2d3e4';
const lesson = demoLessons()[0];
const activity = lesson.concepts[1].variants.find((variant): variant is TryItVariant => variant.type === 'tryit')!;
const check = lesson.quiz.find(item => item.conceptId === 'refraction')!;
async function unlock(page: Page, id = a, pin = '111111') {
  await page.getByLabel('Your profile', { exact: true }).selectOption(id);
  await page.getByLabel('Six-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
}
async function lock(page: Page) {
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
}
async function saved(page: Page, id: string, pin: string): Promise<Snapshot> {
  const row = await page.evaluate(id => new Promise<any>((resolve, reject) => {
    const open = indexedDB.open('coteacher-sprint'); open.onsuccess = () => {
      const db = open.result, request = db.transaction('profiles').objectStore('profiles').get(id);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }), id);
  return await decryptPayload(row, pin) as Snapshot;
}
async function complete(page: Page) {
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  await expect(page.locator('.materials')).toContainText('plastic');
  await expect(page.getByRole('region', { name: 'Safety notes' })).toContainText('adult');
  await page.getByRole('button', { name: 'Start activity' }).click();
  for (let index = 0; index < activity.steps.length; index++) {
    await expect(page.locator('.instruction')).toHaveText(activity.steps[index]);
    await page.getByRole('button', { name: index + 1 === activity.steps.length ? 'See why it works' : 'Next instruction', exact: true }).click();
  }
  await expect(page.locator('.activity')).toContainText(activity.explainsWhy);
  await page.getByRole('button', { name: 'Done — return to teacher' }).click();
  await expect(page.locator('.activity-progress')).toContainText('Understanding check pending');
  await expect(page.locator('.quiz-card')).toHaveCount(1);
  await expect(page.locator('.quiz-card')).toContainText(check.prompt);
}

test('offline explanation, safe activity, targeted check and retries survive reopening without mixing learner records', async ({ page, context }, info) => {
  test.setTimeout(90_000);
  await context.addInitScript(() => {
    (window as any).__networkAttempts = [];
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, {
      value: () => { (window as any).__networkAttempts.push(name); throw new Error('Activity must work offline'); },
    });
  });
  await page.goto('/'); await unlock(page);
  await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.getByText('Prepared-content demo ready offline', { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller ? undefined : new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))));
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByRole('button', { name: 'Pause here / explain again', exact: true }).click();
  await expect(page.locator('.help-response')).toContainText('Lesson moment:');
  await complete(page);
  await expect(page.locator('.activity-progress')).toContainText('0 check attempts');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload(); await unlock(page);
  await expect(page.locator('.quiz-card')).toHaveCount(1); // Pending check restores.
  await page.getByRole('button', { name: check.options[0], exact: true }).click();
  await expect(page.locator('.quiz-card [role="status"]')).toContainText('Let’s look at why');
  await expect(page.locator('.activity-progress')).toContainText('1 check attempt');
  await page.getByText('Connect it to your classroom concept', { exact: true }).click();
  await expect(page.locator('.activity-progress')).toContainText(activity.explainsWhy);
  await page.getByRole('button', { name: 'Retry this concept check' }).click();
  await page.getByRole('button', { name: check.options[check.correctIndex], exact: true }).click();
  await expect(page.locator('.quiz-card [role="status"]')).toContainText('You’ve got it');
  await expect(page.locator('.activity-progress')).toContainText('2 check attempts');
  await expect(page.locator('.activity-progress')).toContainText('not proof of long-term learning');
  await page.screenshot({ path: info.outputPath('offline-activity-check-feedback.png'), fullPage: true });
  await lock(page);
  const before = await saved(page, a, '111111');
  expect(before.progress.events.filter(event => event.type === 'quiz-answered')).toMatchObject([
    { selectedIndex: 0, correctness: false, sourceRefs: check.sourceRefs },
    { selectedIndex: check.correctIndex, correctness: true, sourceRefs: check.sourceRefs },
  ]);
  expect(before.progress.events.filter(event => event.type === 'tryit-completed')).toHaveLength(1);
  await unlock(page, b, '222222');
  await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.locator('.activity-progress')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await complete(page);
  await page.getByRole('button', { name: check.options[0], exact: true }).click();
  await lock(page);
  expect((await saved(page, b, '222222')).progress.events.filter(event => event.type === 'quiz-answered')).toMatchObject([{ correctness: false, selectedIndex: 0 }]);
  expect(await saved(page, a, '111111')).toEqual(before);
  await page.close(); page = await context.newPage(); await page.goto('/'); await unlock(page);
  await expect(page.locator('.activity-progress')).toContainText('2 check attempts');
  await expect(page.locator('.activity-progress')).toContainText('latest response to this check was correct');
  await page.getByRole('button', { name: 'Retry this concept check' }).click();
  await expect(page.getByRole('button', { name: check.options[check.correctIndex], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Revisit the teacher’s concept' }).click();
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-step-id', activity.returnToStep);
  await expect(page.locator('.teacher-words')).toHaveJSProperty('open', true);
  expect(await page.evaluate(() => (window as any).__networkAttempts)).toEqual([]);
});
