import { expect, test } from '@playwright/test';
import { teacherSources, teacherReview } from './teacher-navigation';

for (const width of [320, 360, 768, 1440]) test(`teacher workspace and guided preparation work at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('http://127.0.0.1:4274');
  await expect(page.getByRole('heading', { name: 'Welcome back, teacher.' })).toBeVisible();
  await expect(page.locator('.teacher-welcome')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Nunito');
  const fit = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fit(); await page.screenshot({ path: info.outputPath(`teacher-dashboard-${width}.png`), fullPage: true });
  await teacherSources(page);
  await page.getByLabel('Teacher notes (.md / .txt)').setInputFiles({ name: 'unsupported.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a supported text source') });
  await expect(page.getByRole('alert')).toContainText('Markdown or text');
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await expect(page.locator('.uploaded-source')).toHaveCount(2);
  await fit(); await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await expect(page.getByRole('navigation', { name: 'Review concepts' }).getByRole('button')).toHaveCount(2);
  await page.getByRole('navigation', { name: 'Review concepts' }).getByRole('button').nth(1).click();
  await expect(page.locator('[data-concept-id=refraction] .sources').first()).toContainText('teacher-notes.md');
  await fit();
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to recording' }).click();
  await expect(page.getByRole('button', { name: 'Start recording this lesson' })).toBeVisible();
  await page.getByRole('button', { name: 'Start recording this lesson' }).click();
  await page.getByRole('button', { name: 'Start presentation' }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-concept-id', 'refraction');
  await fit(); await page.screenshot({ path: info.outputPath(`teacher-studio-${width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Class insights', exact: true }).click();
  await page.locator('.heat-row button').last().click();
  await expect(page.locator('.contributing-events')).toContainText('Refraction at the water surface'); await fit();
  await expect(page.getByLabel('Lesson', { exact: true })).toHaveValue('light-and-refraction');
  await expect(page.getByText('4 / 18 learners with support signals')).toBeVisible();
  await page.locator('.contributing-events summary').first().click();
  await expect(page.locator('.contributing-events')).toContainText('Understanding check · incorrect');
  await expect(page.locator('.stats')).toContainText('do not establish effectiveness');
  await expect(page.locator('.teacher-page-heading .workspace-tag')).toContainText('sources separated');
  if (width <= 360) {
    const table = page.getByRole('region', { name: 'Explanation use table; scroll to see all columns' });
    expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await table.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  }
  await page.getByLabel('Learning records').selectOption('received');
  await expect(page.getByRole('heading', { name: 'No received learning records yet.' })).toBeVisible();
  await expect(page.getByText('0 / 0 learners with support signals')).toHaveCount(2);
  await page.getByLabel('Learning records').selectOption('seeded');
  await page.screenshot({ path: info.outputPath(`teacher-insights-${width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Review this activity', exact: true }).click();
  await expect(page.locator('[data-concept-id=refraction] [data-variant-id=refraction-tryit]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-variant-id=refraction-tryit]')).toContainText('Safety');
  await expect(page.locator('[data-variant-id=refraction-tryit] .sources')).toContainText('activity-notes.md');
  await fit();
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  await expect(page.getByText('No questions received yet.')).toBeVisible(); await fit();
  await page.getByRole('button', { name: 'Publish packages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish recorded lesson' })).toBeDisabled();
  await expect(page.locator('.readiness-list')).toContainText('Teacher recording needed'); await fit();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Teacher accounts and an authenticated display name are not configured.', { exact: false })).toBeVisible();
  await teacherReview(page); await page.reload();
  await expect(page.getByText('Approved for learner collection', { exact: true })).toBeVisible();
});

test('teacher navigation has a working keyboard skip link and reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4274');
    await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('#teacher-content')).toBeFocused();
    expect(new URL(page.url()).hash).toBe('#/dashboard');
    expect(await page.locator('.teacher-quick-actions button').first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  } finally { await context.close(); }
});
