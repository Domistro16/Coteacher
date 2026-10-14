import { expect, type Page } from '@playwright/test';

export async function assertStudioFits(page: Page, live = false) {
  const controls = [page.getByRole('navigation', { name: 'Presentation controls' }),
    page.getByRole('navigation', { name: 'Presentation concepts' }),
    page.getByRole('button', { name: live ? 'Pause recording' : 'Start audio recording', exact: true })];
  if (live) controls.push(page.getByRole('button', { name: 'Stop and save recording', exact: true }));
  for (const control of controls) {
    await expect(control).toBeVisible();
    expect(await control.evaluate(element => { const box = element.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight + 1 && box.left >= 0 && box.right <= innerWidth + 1; })).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth
    && document.documentElement.scrollHeight <= innerHeight + 1 && scrollY === 0)).toBe(true);
  const canvas = page.locator('.studio-canvas-space .teaching-canvas');
  expect(await canvas.evaluate(element => element.getBoundingClientRect().width / element.getBoundingClientRect().height)).toBeCloseTo(16 / 9, 1);
  expect(await canvas.locator('.explanation').evaluate(element => {
    const content = element.getBoundingClientRect(), stage = element.parentElement!.getBoundingClientRect();
    return content.bottom <= stage.bottom + 1 && content.top >= stage.top;
  })).toBe(true);
}
