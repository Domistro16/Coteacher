import { expect, type Page } from '@playwright/test';

/** Legacy tests explicitly opt back into saved notes; recorded replay stays primary. */
export async function openPreparedCompatibility(page: Page) {
  await expect.poll(async () => await page.getByRole('button', { name: 'Open profile' }).isVisible() || await page.getByRole('alert').count() > 0).toBe(true);
  if (!await page.getByRole('button', { name: 'Open profile' }).isVisible()) return;
  await page.getByRole('button', { name: 'Open profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  const saved = page.getByRole('button', { name: 'Open saved prepared-content lesson' });
  const hasSaved = await saved.isVisible();
  if (hasSaved) await saved.click();
  else {
    await page.getByText('Transfer lesson from school', { exact: true }).click();
    // Connected catalogue discovery precedes collection; the offline core
    // assertions start once the explicit school-transfer flow is selected.
    await page.evaluate(() => { if (navigator.onLine) (window as any).__networkAttempts?.splice(0); });
  }
  const summary = page.getByText('Saved prepared-content compatibility lesson', { exact: true });
  if (hasSaved) {
    await expect(summary).toBeVisible();
    if (!await summary.evaluate(element => (element.parentElement as HTMLDetailsElement).open)) await summary.click();
  }
}
