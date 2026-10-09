import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fixture from '../../fixtures/demo-lesson/lesson-package.json' with { type: 'json' };

const activity = fixture.concepts[1].variants.find(variant => variant.type === 'tryit')!;
const instructions = activity.steps!;
const teacherStep = fixture.timeline.find(step => step.id === activity.returnToStep)!;

async function openOfflinePlayer(page: Page, context: BrowserContext) {
  const errors: string[] = [];
  const offlineRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Resource loading by the browser is allowed; application network APIs are not.
  await page.addInitScript(() => {
    // This browser test exercises a device without a local speech model.
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    const attempts: string[] = [];
    Object.defineProperty(window, '__networkAttempts', { value: attempts });
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) {
      Object.defineProperty(window, name, { value: function blockedNetwork() {
        attempts.push(name);
        throw new Error('Application network API is disabled: ' + name);
      } });
    }
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: function blockedMicrophone() { attempts.push('getUserMedia'); throw new Error('Microphone is stubbed'); },
    });
  });
  await page.goto('/');
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.getByRole('heading', { name: fixture.title, exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Original', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  page.on('request', request => offlineRequests.push(request.url()));
  await context.setOffline(true);
  return async () => {
    expect(errors).toEqual([]);
    expect(offlineRequests).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __networkAttempts: string[] }).__networkAttempts)).toEqual([]);
  };
}

async function expectFitsScreen(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('studies the fixture and completes Try it offline, returning to the teacher moment', async ({ page, context }) => {
  const assertClean = await openOfflinePlayer(page, context);
  await expect(page.getByText('Simulated demo', { exact: true })).toBeVisible();
  await page.getByText('What you will learn', { exact: true }).tap();
  await expect(page.locator('.objective').getByText(fixture.objective.text, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous lesson step', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Refresher', exact: true }).tap();
  await expect(page.getByRole('article', { name: 'Refresher', exact: true })).toContainText(fixture.concepts[0].variants[1].content);
  await expect(page.locator('[data-step-id]')).toHaveAttribute('data-step-id', 'step-light');
  await page.getByRole('button', { name: "Teacher's original", exact: true }).tap();
  await page.getByRole('button', { name: 'Next lesson step', exact: true }).tap();
  await expect(page.getByRole('heading', { name: fixture.concepts[1].title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next lesson step', exact: true })).toBeDisabled();
  await page.getByText('Why these choices?', { exact: true }).tap();
  await expect(page.locator('.route-reason').getByText(fixture.route.conceptRoutes[1].reason, { exact: true })).toBeVisible();

  for (const [type, label] of [['short', 'Short'], ['analogy', 'Analogy'], ['stepwise', 'Step by step']]) {
    await page.getByRole('button', { name: label, exact: true }).tap();
    const article = page.getByRole('article', { name: label, exact: true });
    await expect(article).toContainText(fixture.concepts[1].variants.find(variant => variant.type === type)!.content);
    await expect(article.getByRole('group', { name: 'Sources', exact: true })).toContainText(fixture.sources[0].citation);
  }
  await page.getByRole('button', { name: "Teacher's original", exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Try it', exact: true }).tap();
  for (const item of activity.items!) await expect(page.getByText(item, { exact: true })).toBeVisible();
  for (const note of activity.safetyNotes!) await expect(page.getByText(note, { exact: true })).toBeVisible();
  await expectFitsScreen(page);
  await page.getByRole('button', { name: 'Start activity', exact: true }).tap();
  for (let i = 0; i < instructions.length; i++) {
    await expect(page.getByRole('heading', { name: `Try it — Instruction ${i + 1} of ${instructions.length}`, exact: true })).toBeVisible();
    await expect(page.getByText(instructions[i], { exact: true })).toBeVisible();
    const sources = page.getByRole('article').getByRole('group', { name: 'Sources', exact: true });
    for (const source of fixture.sources) await expect(sources).toContainText(source.citation);
    await expectFitsScreen(page);
    await page.getByRole('button', { name: i + 1 === instructions.length ? 'See why it works' : 'Next instruction', exact: true }).tap();
  }
  await expect(page.getByRole('heading', { name: 'Why it works', exact: true })).toBeVisible();
  await expect(page.getByText(activity.explainsWhy!, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done — return to teacher', exact: true }).tap();
  await expect(page.locator('[data-step-id]')).toHaveAttribute('data-step-id', teacherStep.id);
  await expect(page.getByRole('article', { name: 'Original', exact: true })).toHaveAttribute('data-variant-id', teacherStep.defaultVariantId);
  await expect(page.getByRole('article')).toContainText(fixture.concepts[1].variants[0].content);
  await page.getByText("Your teacher's words", { exact: true }).tap();
  await expect(page.locator('.teacher-words').getByText(teacherStep.teacherSaid, { exact: true })).toBeVisible();
  await assertClean();
});

for (const phase of ['preparation', 'instructions']) {
  test(`can leave Try it during ${phase} and restart fresh`, async ({ page, context }) => {
    const assertClean = await openOfflinePlayer(page, context);
    await page.getByRole('button', { name: 'Next lesson step', exact: true }).tap();
    await page.getByRole('button', { name: 'Try it', exact: true }).tap();
    if (phase === 'instructions') {
      await page.getByRole('button', { name: 'Start activity', exact: true }).tap();
      await page.getByRole('button', { name: 'Next instruction', exact: true }).tap();
    }
    await page.getByRole('button', { name: "Teacher's original", exact: true }).tap();
    await expect(page.getByRole('article', { name: 'Original', exact: true })).toHaveAttribute('data-variant-id', teacherStep.defaultVariantId);
    await page.getByRole('button', { name: 'Try it', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Start activity', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Original', exact: true }).tap();
    await page.getByRole('button', { name: 'Previous lesson step', exact: true }).tap();
    await expect(page.getByRole('article')).toHaveAttribute('data-variant-id', 'light-original');
    await assertClean();
  });
}

test('fits a 320px screen, exposes touch targets, and offers offline typing', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const assertClean = await openOfflinePlayer(page, context);
  await expectFitsScreen(page);
  await page.getByRole('button', { name: 'Next lesson step', exact: true }).tap();
  await expectFitsScreen(page);
  await page.getByRole('button', { name: 'Try it', exact: true }).tap();
  await expectFitsScreen(page);
  const heights = await page.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
  expect(heights.every(height => height >= 44)).toBe(true);
  const original = page.getByRole('button', { name: "Teacher's original", exact: true });
  await original.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article')).toHaveAttribute('data-variant-id', teacherStep.defaultVariantId);
  await page.getByRole('button', { name: 'Hold to talk', exact: true }).tap();
  await expect(page.locator('.question-draft').getByText('Offline voice is unavailable on this device. Please type your question.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Type your question', exact: true }).fill('Simulated question draft');
  await expect(page.getByRole('textbox', { name: 'Type your question' })).toHaveValue('Simulated question draft');
  await assertClean();
});
