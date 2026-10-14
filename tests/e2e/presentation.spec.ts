import { teacherSources, teacherReview, teacherTransfers, expectTeacherExport } from './teacher-navigation';
import { openPreparedCompatibility } from './compatibility';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decryptPayload, validateLessonPackage, type LessonPackage } from '@coteacher/shared';
import { preparationKey } from '../../apps/teacher/src/preparation';

async function approve(page: Page) {
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
}
async function stored(page: Page): Promise<LessonPackage[]> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).drafts, preparationKey);
}

test('approved manual presentation persists actual visits and learners revisit the exact classroom concept offline', async ({ page, context }, info) => {
  test.setTimeout(90_000);
  const teacher = await context.newPage();
  await teacher.setViewportSize({ width: 1280, height: 900 });
  await teacher.addInitScript(() => {
    const attempts: string[] = [];
    Object.defineProperty(window, '__speechAttempts', { value: attempts });
    const blocked = () => { attempts.push('speech'); throw new Error('Presentation must not request speech input'); };
    Object.defineProperty(window, 'SpeechRecognition', { value: blocked });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: blocked });
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: blocked });
  });
  await teacher.goto('http://127.0.0.1:4274');
  await teacher.getByRole('button', { name: 'Teach / projector' }).click();
  await expect(teacher.getByRole('button', { name: 'Start presentation' })).toBeDisabled();
  await expect(teacher.locator('[data-presentation-step-id]')).toHaveCount(0);
  await approve(teacher);
  const approved = await stored(teacher);
  await teacher.getByRole('button', { name: 'Teach / projector' }).click();
  await teacher.getByRole('button', { name: 'Start presentation' }).click();
  await expect(teacher.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await expect(teacher.getByRole('button', { name: 'Previous visual' })).toBeDisabled();
  await teacher.getByRole('button', { name: 'Next visual' }).focus();
  await teacher.keyboard.press('Enter');
  await expect(teacher.locator('.cue')).toHaveAttribute('data-presentation-concept-id', 'refraction');
  await expect(teacher.getByRole('button', { name: 'Next visual' })).toBeDisabled();
  const classroomExplanation = await teacher.locator('.cue .explanation').innerText();
  const classroomVisual = await teacher.locator('.cue svg').getAttribute('aria-label');
  await teacher.getByRole('button', { name: 'Previous visual' }).click();
  await teacher.getByRole('navigation', { name: 'Presentation concepts' }).getByRole('button', { name: '2. Refraction at the water surface' }).click();
  await teacher.getByRole('button', { name: 'Focus studio', exact: true }).click();
  await expect(teacher.getByRole('navigation', { name: 'Teacher workspace' })).toBeHidden();
  await expect(teacher.getByRole('heading', { name: 'Refraction at the water surface' })).toBeVisible();
  await teacher.getByRole('button', { name: 'Lesson notes & sources' }).click();
  await expect(teacher.locator('.cue .sources')).toContainText('teacher-notes.md');
  await teacher.getByRole('button', { name: 'Return to studio' }).click();
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await teacher.getByRole('navigation', { name: 'Presentation controls' }).evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await teacher.screenshot({ path: info.outputPath('projector-refraction.png'), fullPage: true });
  await teacher.reload();
  await expect(teacher.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await expect(teacher.getByRole('button', { name: 'Focus studio', exact: true })).toBeVisible();
  await teacher.getByRole('button', { name: 'Lesson notes & sources' }).click();
  await teacher.getByText('Classroom timeline', { exact: false }).click();
  await expect(teacher.locator('.classroom-history li')).toHaveCount(4);
  await teacher.getByRole('button', { name: 'Return to studio' }).click();
  const presented = await stored(teacher);
  for (let i = 0; i < presented.length; i++) {
    const { classroomTimeline, ...content } = presented[i];
    expect(content).toEqual(approved[i]);
    expect(classroomTimeline?.visits.map(visit => visit.timelineStepId)).toEqual(['step-light', 'step-refraction', 'step-light', 'step-refraction']);
  }
  expect(presented[0].classroomTimeline).toEqual(presented[1].classroomTimeline);
  expect(await teacher.evaluate(() => (window as unknown as { __speechAttempts: string[] }).__speechAttempts)).toEqual([]);
  await teacher.close();
  const reopened = await context.newPage();
  await reopened.goto('http://127.0.0.1:4274');
  await reopened.getByRole('button', { name: 'Teach / projector', exact: true }).click();
  await expect(reopened.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await reopened.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  const files: string[] = [];
  for (const [label, pin] of [['Student A', '111111'], ['Student B', '222222']]) {
    const download = reopened.waitForEvent('download');
    await teacherTransfers(reopened);
    await reopened.getByRole('button', { name: `Export ${label} package` }).click();
    const path = (await download).path(); files.push((await path)!);
    const result = validateLessonPackage(await decryptPayload(JSON.parse(await readFile(files.at(-1)!, 'utf8')), pin));
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('Invalid package');
    expect(result.data.classroomTimeline).toEqual(presented[0].classroomTimeline);
  }

  // Prove concept selection runs entirely on the already collected package.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, { value: () => { throw new Error('Offline concept revisit attempted networking'); } });
  });
  await page.goto('/');
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
  await page.getByLabel('Import lesson file').setInputFiles(files[0]);
  await expect(page.getByText('Prepared-content demo ready offline', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByText('Revisit the classroom timeline', { exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Learner concept timeline' }).getByRole('button')).toHaveCount(4);
  await page.getByRole('navigation', { name: 'Learner concept timeline' }).getByRole('button', { name: '2. Refraction at the water surface' }).click();
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-lesson-id', presented[0].lessonId);
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-step-id', 'step-refraction');
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-concept-id', 'refraction');
  await expect(page.locator('.teacher-words blockquote')).toHaveText(classroomExplanation);
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-original');
  await expect(page.locator('.lesson-step svg')).toHaveAttribute('aria-label', classroomVisual!);
  await expect(page.locator('.teacher-words .sources')).toContainText('teacher-notes.md');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('learner-exact-classroom-concept.png'), fullPage: true });
  await page.reload();
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-step-id', 'step-refraction');
  await page.getByText('Revisit the classroom timeline', { exact: true }).click();
  await page.getByRole('navigation', { name: 'Learner concept timeline' }).getByRole('button', { name: '1. Light travels along straight paths' }).click();
  await expect(page.locator('.lesson-step')).toHaveAttribute('data-concept-id', 'light-path');
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await page.getByLabel('Your profile').selectOption('student-b1c2d3e4');
  await page.getByLabel('Six-digit PIN').fill('222222');
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
  await openPreparedCompatibility(page);
  await page.getByLabel('Import lesson file').setInputFiles(files[1]);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-stepwise');
  await page.getByText('Revisit the classroom timeline', { exact: true }).click();
  await page.getByRole('navigation', { name: 'Learner concept timeline' }).getByRole('button', { name: '4. Refraction at the water surface' }).click();
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-original');
  await expect(page.locator('.teacher-words blockquote')).toHaveText(classroomExplanation);
});

test('presentation save failure preserves last visible moment and reapproval removes stale classroom state', async ({ page }) => {
  await page.goto('http://127.0.0.1:4274');
  await approve(page);
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await page.getByRole('button', { name: 'Start presentation' }).click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await page.reload();
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await expect(page.locator('.classroom-history summary')).toContainText('1 visit');
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await expect(page.getByRole('button', { name: 'Start presentation' })).toBeDisabled();
  await expect(page.locator('[data-presentation-step-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  expect((await stored(page)).every(lesson => !lesson.classroomTimeline)).toBe(true);
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await expect(page.getByRole('button', { name: 'Start presentation' })).toBeEnabled();
  await expect(page.locator('[data-presentation-step-id]')).toHaveCount(0);
});
