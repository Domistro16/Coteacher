import { expect, test } from '@playwright/test';

// Isolate empty/error presentation from the publication created by the native
// recording test. Actual delivery and offline playback run in recording.spec.
test.use({ serviceWorkers: 'block' });
for (const width of [320, 360, 768, 1440]) {
  test(`purposeful student screens, keyboard navigation and profile separation at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/lessons/*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No recorded teacher lesson is published yet.' }) }));
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByLabel('Six-digit PIN').fill('000000');
    await page.getByRole('button', { name: 'Unlock my profile' }).click();
    await expect(page.getByRole('alert')).toContainText('PIN');
    await page.getByLabel('Six-digit PIN').fill('111111');
    await page.getByRole('button', { name: 'Unlock my profile' }).click();
    await expect(page.getByRole('heading', { name: 'Hey, Student A!' })).toBeVisible();
    await expect(page.getByLabel('Import lesson file')).toHaveCount(0);
    await expect(page.locator('.video-card')).toHaveCount(0);
    await expect(page.getByText('No recorded teacher lesson is published yet.', { exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const [name, heading] of [['My Lessons','My Lessons'],['Downloads','Downloads'],['Progress','Your learning journey'],['Profile','Profile']] as const) {
      await nav.getByRole('button', { name, exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      const route = await page.evaluate(() => location.hash);
      await page.getByRole('link', { name: 'Skip to content' }).focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => location.hash)).toBe(route);
      await expect(page.locator('#student-content')).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByText('Transfer lesson from school', { exact: true }).click();
    await expect(page.getByLabel('Import lesson file')).toBeVisible();
    await nav.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.getByLabel('Import lesson file')).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Switch learner', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await page.getByLabel('Your profile', { exact: true }).selectOption('student-b1c2d3e4');
    await page.getByLabel('Six-digit PIN').fill('222222');
    await page.getByRole('button', { name: 'Unlock my profile' }).click();
    await expect(page.getByRole('heading', { name: 'Hey, Student B!' })).toBeVisible();
    await expect(page.getByText('Hey, Student A!', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`student-home-${width}.png`), fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.video-card')).toHaveCount(0);
  });
}
