import { teacherSources, teacherReview, teacherTransfers, expectTeacherExport } from './teacher-navigation';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decryptPayload, encryptPayload, localLessonGenerator, reviewedMaterials, validateLessonPackage } from '@coteacher/shared';
import { preparationKey } from '../../apps/teacher/src/preparation';
import { openPreparedCompatibility } from './compatibility';

test('prepare, inspect sources and concepts, restart, approve, export and collect only approved content', async ({ page, context }, info) => {
  test.setTimeout(60_000);
  const teacher = await context.newPage();
  await teacher.goto('http://127.0.0.1:4274');
  await teacher.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await expect(teacher.getByRole('region', { name: 'Selected demo lesson' })).toContainText('Science');
  await expect(teacher.locator('.lesson-identity')).toContainText('Light and refraction');
  await expect(teacher.locator('.lesson-identity')).toContainText('JSS 2 (simulated demo)');
  await teacherSources(teacher);
  await teacher.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await teacher.getByText('Read teacher notes', { exact: false }).click();
  await expect(teacher.locator('.source-preview pre').first()).toContainText('uniform medium');
  await teacher.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await expect(teacher.getByRole('button', { name: 'Approve lesson', exact: true })).toBeDisabled();
  await expectTeacherExport(teacher, false);
  for (const id of ['light-path', 'refraction']) {
    await teacher.getByRole('navigation', { name: 'Review concepts' }).getByRole('button').nth(id === 'light-path' ? 0 : 1).click();
    const concept = teacher.locator(`[data-concept-id="${id}"]`);
    await expect(concept).toContainText(`Concept: ${id}`);
    await expect(concept.locator('.sources').first()).toContainText('teacher-notes.md');
    await expect(concept.locator('svg')).toBeVisible();
    await concept.getByText('original explanation', { exact: true }).click();
    await expect(concept.locator('details').first().locator('.sources')).toBeVisible();
    const alternative = concept.locator('details').nth(1);
    await alternative.locator('summary').click();
    await expect(alternative.locator('.sources')).toBeVisible();
    await concept.getByText('Understanding check', { exact: false }).click();
    await expect(concept.locator('details').last()).toContainText('(correct)');
  }
  await teacher.locator('[data-concept-id="refraction"]').getByText('tryit explanation', { exact: true }).click();
  await expect(teacher.locator('[data-concept-id="refraction"]')).toContainText('One clear plastic cup');
  await teacher.reload();
  await expect(teacher.locator('[data-concept-id]')).toHaveCount(1);
  await expectTeacherExport(teacher, false);

  // Exercise the learner boundary directly with a valid encrypted draft.
  await page.goto('/');
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
  const draft = localLessonGenerator.generate(reviewedMaterials.teacherNotes, reviewedMaterials.activityNotes)[0];
  await page.getByLabel('Import lesson file').setInputFiles({ name: 'draft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(await encryptPayload(draft, '111111'))) });
  await expect(page.getByRole('alert')).toContainText('not been approved');
  await expect(page.locator('[data-step-id]')).toHaveCount(0);

  await teacher.getByRole('checkbox').check();
  await expectTeacherExport(teacher, false);
  await teacher.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  const saved = await teacher.evaluate(key => JSON.parse(localStorage.getItem(key)!), preparationKey);
  expect(saved.drafts.every((lesson: typeof draft) => lesson.publication.status === 'approved')).toBe(true);
  await teacher.close();
  const reopened = await context.newPage();
  await reopened.goto('http://127.0.0.1:4274');
  await teacherReview(reopened);
  await expect(reopened.getByText('Approved for learner collection', { exact: true })).toBeVisible();
  await expectTeacherExport(reopened, true);
  await expect(reopened.getByRole('button', { name: 'Approve lesson', exact: true })).toBeDisabled();
  const packages = [];
  for (const [label, pin] of [['Student A', '111111'], ['Student B', '222222']]) {
    const download = reopened.waitForEvent('download');
    await teacherTransfers(reopened);
    await reopened.getByRole('button', { name: `Export ${label} package` }).click();
    const path = (await download).path();
    const value = await decryptPayload(JSON.parse(await readFile((await path)!, 'utf8')), pin);
    const result = validateLessonPackage(value);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('Invalid exported package');
    expect(result.data.publication).toMatchObject({ status: 'approved', approvalKind: 'teacher-review' });
    packages.push(result.data);
    if (label === 'Student A') {
      await page.getByLabel('Import lesson file').setInputFiles((await path)!);
      await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
    }
  }
  expect(packages[0].objective).toEqual(packages[1].objective);
  expect(packages[0].concepts).toEqual(packages[1].concepts);
  expect(packages[0].route).not.toEqual(packages[1].route);
  await reopened.screenshot({ path: info.outputPath('approved-preparation.png'), fullPage: true });

  // Revoking review and regenerating both restore the real publication gate.
  await teacherReview(reopened);
  await reopened.getByRole('checkbox').uncheck();
  await expectTeacherExport(reopened, false);
  await reopened.reload();
  await expect(reopened.getByRole('button', { name: 'Approve lesson', exact: true })).toBeDisabled();
  await reopened.getByRole('checkbox').check();
  await reopened.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await teacherSources(reopened);
  await reopened.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await expectTeacherExport(reopened, false);
  await expect(reopened.getByRole('checkbox')).not.toBeChecked();
  await reopened.getByRole('checkbox').check();
  await reopened.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await teacherSources(reopened);
  await reopened.getByLabel('Teacher notes (.md / .txt)').setInputFiles('fixtures/demo-lesson/teacher-notes.md');
  await expect(reopened.locator('[data-concept-id]')).toHaveCount(0);
  await reopened.reload();
  await teacherSources(reopened);
  await reopened.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await expectTeacherExport(reopened, false);
});

test('failed persistence cannot approve; corrupt saved preparation fails visibly', async ({ page }) => {
  await page.goto('http://127.0.0.1:4274');
  await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await page.getByRole('checkbox').check();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expectTeacherExport(page, false);
  await page.reload();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expectTeacherExport(page, false);
  await page.evaluate(key => localStorage.setItem(key, '{broken'), preparationKey);
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-concept-id]')).toHaveCount(0);
  await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await expectTeacherExport(page, false);
});
