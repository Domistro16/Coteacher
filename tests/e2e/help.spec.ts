import { openPreparedCompatibility } from './compatibility';
import { expect, test, type Page, type BrowserContext } from '@playwright/test';

async function unlock(page: Page, profile = 'student-a1b2c3d4', pin = '111111') {
  await page.getByLabel('Your profile').selectOption(profile);
  await page.getByLabel('Six-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
}
async function saved(page: Page) {
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
}
async function ask(page: Page, text: string) {
  await page.getByLabel('Type your question').fill(text);
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
}
async function variant(page: Page, id: string) {
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', id);
  await expect(page.locator('[data-step-id]')).toHaveAttribute('data-step-id', id.startsWith('light-') ? 'step-light' : 'step-refraction');
}
async function offline(page: Page, context: BrowserContext) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const attempts: string[] = [];
    Object.defineProperty(window, '__networkAttempts', { value: attempts });
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, {
      value: () => { attempts.push(name); throw new Error('Unexpected student network call'); },
    });
  });
  await page.goto('/'); await unlock(page);
  await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await saved(page);
  await expect(page.getByText('Prepared-content demo ready offline', { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller ? undefined : new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))));
  await context.setOffline(true);
  return async () => {
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __networkAttempts: string[] }).__networkAttempts)).toEqual([]);
  };
}

test('unseen rotation survives manual views, navigation, offline reload and separate profiles', async ({ page, context }) => {
  const clean = await offline(page, context);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByRole('button', { name: 'Short', exact: true }).click();
  await page.getByRole('button', { name: "Teacher's original", exact: true }).click();
  await ask(page, 'could you give me another explanation?');
  await variant(page, 'refraction-analogy');
  await saved(page); await page.reload(); await unlock(page);
  await page.getByRole('button', { name: 'Pause here / explain again' }).click();
  await variant(page, 'refraction-stepwise');
  await page.getByRole('button', { name: 'Previous lesson step' }).click();
  await ask(page, 'explain differently');
  await variant(page, 'light-refresher');
  await ask(page, 'explain differently');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await expect(page.getByRole('button', { name: 'Try the activity', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Type a question', exact: true }).click();
  await expect(page.getByLabel('Type your question')).toBeFocused();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await ask(page, 'explain it another way');
  await variant(page, 'refraction-original');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await page.getByRole('button', { name: 'Try the activity', exact: true }).click();
  await variant(page, 'refraction-tryit');
  await expect(page.getByRole('region', { name: 'Safety notes', exact: true })).toContainText('plastic');
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await unlock(page, 'student-b1c2d3e4', '222222');
  await page.getByText('Prepared-content compatibility demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await variant(page, 'refraction-stepwise');
  for (const id of ['refraction-original', 'refraction-short', 'refraction-analogy']) {
    await ask(page, 'can you say it differently'); await variant(page, id);
  }
  await saved(page); await page.reload(); await unlock(page, 'student-b1c2d3e4', '222222');
  await ask(page, 'explain that again');
  await variant(page, 'refraction-analogy');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await page.getByRole('button', { name: 'Lock / switch learner' }).click(); await unlock(page);
  await ask(page, 'explain that again');
  await variant(page, 'refraction-tryit');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await expect(page.locator('.queued')).toHaveCount(0);
  await clean();
});

test('confusion suffixes get sourced matches or honest queued no-match without moving the lesson', async ({ page, context }) => {
  const clean = await offline(page, context);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  const prefix = "Pause here. I understand this part, but I don't understand ";
  await ask(page, prefix + 'Why does the pencil look broken?');
  await variant(page, 'refraction-short');
  await expect(page.locator('.question-response')).toContainText('The pencil is straight.');
  await expect(page.locator('.question-response .sources')).toContainText('teacher-notes.md');
  await ask(page, prefix + 'Does light travel straight before reaching the water surface?');
  await variant(page, 'refraction-analogy');
  await expect(page.locator('.question-response')).toContainText('Lesson moment: In a uniform medium, light travels along a straight path.');
  await ask(page, prefix + 'How does a rainbow form?');
  await variant(page, 'refraction-stepwise');
  await expect(page.locator('.question-response')).toContainText('I do not have a prepared answer');
  await expect(page.locator('.queued h3')).toHaveText(['How does a rainbow form']);
  await ask(page, prefix + 'this');
  await expect(page.locator('.queued h3')).toHaveCount(1);
  await expect(page.locator('.question-response')).toHaveCount(0);
  for (const text of ["I'm lost in Abuja", "I didn't get that parcel", 'How does a rainbow form?']) {
    await ask(page, text);
    await variant(page, 'refraction-stepwise');
    await expect(page.locator('.help-response')).toHaveCount(0);
    await expect(page.locator('.question-response')).toContainText('I do not have a prepared answer');
  }
  await ask(page, 'Why does the pencil look broken?');
  await variant(page, 'refraction-stepwise');
  await expect(page.locator('.question-response')).toContainText('The pencil is straight.');
  await expect(page.locator('.queued h3')).toHaveCount(4);
  await ask(page, prefix + 'Why does a rainbow form?');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await expect(page.locator('.question-response')).toContainText('I do not have a prepared answer');
  await expect(page.getByRole('button', { name: 'Type a question', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Try the activity', exact: true })).toHaveCount(1);
  await clean();
});

test('an optional refresher counts as seen at its own step', async ({ page, context }) => {
  const clean = await offline(page, context);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByText('Optional: remember the straight light path', { exact: true }).click();
  await expect(page.locator('.refresher')).toHaveAttribute('open', '');
  await saved(page); await page.reload(); await unlock(page);
  await page.getByRole('button', { name: 'Previous lesson step' }).click();
  await ask(page, 'explain that again');
  await variant(page, 'light-original');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await clean();
});
