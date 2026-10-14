import { expect, test, type Page } from '@playwright/test';
import { teacherSources } from './teacher-navigation';
import { assertStudioFits } from './studio-assertions';

async function studio(page: Page) {
  await page.goto('http://127.0.0.1:4274'); await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await page.getByRole('button', { name: 'Start presentation' }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible({ timeout: 25000 });
}

test('clean projector follows local offline controls, fullscreen, reload and studio reconnection', async ({ page, context }, info) => {
  test.setTimeout(90000);
  await studio(page);
  for (const [width, height] of [[320, 640], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await assertStudioFits(page);
    await page.screenshot({ path: info.outputPath(`studio-ready-${width}.png`) });
  }
  const opened = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Open projector display' }).click();
  const projector = await opened; await projector.setViewportSize({ width: 1280, height: 720 });
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await expect(projector.locator('.teaching-canvas')).toHaveAttribute('data-source-refs', 'notes-light');
  await expect(page.getByRole('navigation', { name: 'Teacher workspace' })).toBeVisible();
  await expect(projector.locator('button,input,textarea,audio,nav,.sources,.recording-panel,.teacher-sidebar')).toHaveCount(0);
  await projector.keyboard.press('f');
  await expect.poll(() => projector.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await projector.keyboard.press('Escape');
  await expect.poll(() => projector.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await page.getByRole('button', { name: 'Previous visual' }).click();
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await page.locator('#teacher-content').focus(); await page.keyboard.press('ArrowRight');
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await context.setOffline(false);
  await projector.addInitScript(() => {
    (window as any).__projectorMicCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => { (window as any).__projectorMicCalls++; throw new Error('Projector must not request a microphone'); };
  });
  await projector.reload();
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  expect(await projector.evaluate(() => (window as any).__projectorMicCalls)).toBe(0);
  await page.reload();
  await expect(page.getByText('Projector connected', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Previous visual' }).click();
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await projector.screenshot({ path: info.outputPath('clean-projector.png') });
  await projector.close();
  await expect(page.getByText('Projector closed · reopen anytime', { exact: true })).toBeVisible({ timeout: 10000 });
  const reopen = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Open projector display' }).click();
  const returned = await reopen;
  await expect(returned.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await page.getByRole('button', { name: 'My Lessons', exact: true }).click();
  await expect(returned.locator('.classroom-projector')).toHaveAttribute('data-connected', 'false');
  await returned.close();
});

test('blocked popup and unavailable channels offer a working single-screen fallback; notes exclude shortcuts', async ({ page }) => {
  await studio(page); await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { window.open = () => null; });
  await page.getByRole('button', { name: 'Open projector display' }).click();
  await expect(page.getByRole('alert')).toContainText('window was blocked');
  await page.getByRole('button', { name: 'Focus studio', exact: true }).click();
  await assertStudioFits(page);
  await page.getByRole('button', { name: 'Lesson notes & sources' }).click();
  await expect(page.getByRole('dialog')).toContainText('teacher-notes.md');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await page.getByRole('button', { name: 'Exit focused studio' }).click();
  await page.evaluate(() => Object.defineProperty(window, 'BroadcastChannel', { value: undefined }));
  await page.getByRole('button', { name: 'Open projector display' }).click();
  await expect(page.getByRole('alert')).toContainText('cannot link a second display');
  await page.getByRole('button', { name: 'Focus studio', exact: true }).click(); await assertStudioFits(page);
});

test('a missing display-close message is detected after studio reload and reopening restores the current visual', async ({ page }) => {
  test.setTimeout(60000); await studio(page);
  const opening = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Open projector display' }).click();
  const projector = await opening;
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await page.reload();
  await expect(page.getByText('Projector connected', { exact: true })).toBeVisible({ timeout: 10000 });
  // Crash/abrupt-close equivalent: drop only the normal closure channel message.
  // All startup/state/heartbeat messages still use the real browser channel.
  await projector.evaluate(() => {
    const post = BroadcastChannel.prototype.postMessage;
    BroadcastChannel.prototype.postMessage = function(this: BroadcastChannel, message: any) {
      if (message?.kind !== 'display-closed') post.call(this, message);
    };
  });
  await projector.close();
  await expect(page.getByText('Projector not responding · reopen anytime', { exact: true })).toBeVisible({ timeout: 15000 });
  const reopening = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Open projector display' }).click();
  const recovered = await reopening;
  await expect(recovered.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await expect(page.getByText('Projector connected', { exact: true })).toBeVisible();
  await recovered.close();
});
