import { expect, type Page } from '@playwright/test';

export async function teacherSources(page: Page) {
  await page.getByRole('navigation', { name: 'Teacher workspace' }).getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Preparation steps' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Preparation steps' }).getByRole('button', { name: 'Teaching materials' }).click();
  await expect(page.getByLabel('Teacher notes (.md / .txt)')).toBeVisible();
}
export async function teacherReview(page: Page) {
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await page.getByRole('navigation', { name: 'Preparation steps' }).getByRole('button', { name: 'Prepare & review' }).click();
  await expect(page.getByRole('button', { name: 'Approve lesson', exact: true })).toBeVisible();
}
export async function teacherTransfers(page: Page) {
  await page.getByRole('button', { name: 'Sync & Transfers', exact: true }).click();
  await expect(page.getByLabel('Import encrypted progress')).toBeVisible();
}
export async function expectTeacherExport(page: Page, enabled: boolean) {
  const previous = new URL(page.url()).hash.slice(2);
  await teacherTransfers(page);
  const button = page.getByRole('button', { name: 'Export Student A package' });
  if (enabled) await expect(button).toBeEnabled(); else await expect(button).toBeDisabled();
  const titles: Record<string, string> = { prepare: 'Prepare lesson', teach: 'Teach / projector', review: 'Recording review', insights: 'Class insights', dashboard: 'Dashboard', publish: 'Publish packages' };
  if (titles[previous]) await page.getByRole('button', { name: titles[previous], exact: true }).click();
}
