import { expect, type Page } from '@playwright/test';

/** The tutor floats; the explicitly requested quiz uses a native modal. */
export async function assertCompanionDock(page: Page) {
  const quiz = page.getByRole('dialog', { name: 'Your quick check', exact: true });
  if (await quiz.count()) {
    await expect(quiz).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(1);
    expect(await quiz.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.querySelector('.contextual-quiz-modal')?.contains(document.activeElement))).toBe(true);
    return;
  }
  const dock = page.getByRole('region', { name: 'Coteacher lesson companion', exact: true });
  await expect(dock).toBeVisible();
  await dock.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const player = page.getByRole('region', { name: 'Recorded classroom lesson', exact: true });
  const canvas = player.locator('.replay-stage svg');
  const controls = player.locator('.player-controls');
  const [assistant, visual, playback, frame] = await Promise.all([dock.boundingBox(), canvas.boundingBox(), controls.boundingBox(), player.boundingBox()]);
  expect(assistant && visual && playback && frame).toBeTruthy();
  const overlaps = (a: NonNullable<typeof assistant>, b: NonNullable<typeof assistant>) => a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
  expect(overlaps(assistant!, visual!)).toBe(true);
  expect(overlaps(assistant!, playback!)).toBe(false);
  expect(assistant!.x).toBeGreaterThanOrEqual(frame!.x - 1);
  expect(assistant!.x + assistant!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
  expect(assistant!.y + assistant!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  expect(assistant!.y).toBeGreaterThanOrEqual(visual!.y);
  expect(assistant!.y + assistant!.height).toBeLessThanOrEqual(visual!.y + visual!.height + 1);
  expect(await player.evaluate(element => getComputedStyle(element).display)).toBe('block');
  expect(await dock.evaluate(element => [...element.querySelectorAll('*')].some(child => ['auto', 'scroll'].includes(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight))).toBe(false);
  for (const control of [dock.getByRole('button', { name: 'Close learning panel', exact: true }), dock.getByRole('button', { name: 'Return to recorded lesson', exact: true })]) {
    const box = await control.boundingBox(); expect(box).toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(assistant!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(assistant!.y + assistant!.height + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // A non-modal companion permits keyboard focus on the original playback controls.
  await page.getByLabel('Seek recorded lesson', { exact: true }).focus();
  await expect(page.getByLabel('Seek recorded lesson', { exact: true })).toBeFocused();
  const tools = page.locator('.companion-lesson-tools');
  if (!await tools.evaluate(element => (element as HTMLDetailsElement).open)) await dock.getByRole('button', { name: 'Ask or explore this concept', exact: true }).click();
  await expect(page.getByLabel('Which part of this recorded concept is unclear?', { exact: true })).toBeVisible();
}
