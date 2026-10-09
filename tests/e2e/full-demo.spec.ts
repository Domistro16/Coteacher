import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { demoLessons, encryptPayload, queuedDemoQuestion } from '@coteacher/shared';

async function unlock(page: Page, profile = 'student-a1b2c3d4', pin = '111111') {
  await page.getByLabel('Your profile').selectOption(profile);
  await page.getByLabel('Six-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
}
async function saved(page: Page) { await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible(); }
async function ask(page: Page, text: string) {
  await page.getByLabel('Type your question').fill(text);
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
}
async function fit(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

test('complete school collection, offline study, two learners, teacher insights, and simulated answer return', async ({ page, context }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const attempts: string[] = [];
    Object.defineProperty(window, '__networkAttempts', { value: attempts });
    for (const name of ['fetch','XMLHttpRequest','WebSocket']) Object.defineProperty(window,name,{value: () => { attempts.push(name); throw new Error('Student application attempted networking'); }});
  });
  const teacher = await context.newPage();
  await teacher.setViewportSize({ width: 1280, height: 900 });
  await teacher.goto('http://127.0.0.1:4274');
  await teacher.getByLabel('Teacher notes (.md / .txt)').setInputFiles('fixtures/demo-lesson/teacher-notes.md');
  await teacher.getByLabel('Approved activity source (.md / .txt)').setInputFiles('fixtures/demo-lesson/activity-notes.md');
  await teacher.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await expect(teacher.getByRole('button', { name: 'Export Student A package' })).toBeDisabled();
  await teacher.getByRole('checkbox').check();
  await teacher.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await teacher.screenshot({ path: info.outputPath('teacher-preparation.png'), fullPage: true });
  await teacher.getByRole('button', { name: 'Teach / projector' }).click();
  await teacher.getByRole('button', { name: 'Start presentation' }).click();
  await teacher.getByRole('button', { name: 'Next visual' }).click();
  await expect(teacher.getByRole('heading', { name: 'Refraction at the water surface' })).toBeVisible();
  await teacher.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  const packageDownload = teacher.waitForEvent('download');
  await teacher.getByRole('button', { name: 'Export Student A package' }).click();
  const packagePath = (await packageDownload).path();
  await teacher.getByRole('button', { name: 'Class insights' }).click();
  await expect(teacher.getByText('12 / 18 learners paused or asked an unmatched question')).toBeVisible();

  await page.goto('/');
  await unlock(page);
  await page.getByLabel('Import lesson file').setInputFiles((await packagePath)!);
  await saved(page);
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller ? undefined : new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once:true }))));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await unlock(page);
  await expect(page.locator('[data-step-id]')).toHaveAttribute('data-step-id','step-light');
  await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
  await expect(page.locator('.narration-status')).toHaveAttribute('data-backend', 'clip');
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await ask(page,"Pause here. I understand this part, but I don't understand this");
  await expect(page.getByRole('article', { name: 'Short', exact: true })).toBeVisible();
  await expect(page.locator('.answer .sources')).toContainText('teacher-notes.md');
  await ask(page,'could you put it another way?');
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-analogy');
  await ask(page,'explain that again');
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-stepwise');
  await ask(page,'break it down');
  await expect(page.locator('.help-response')).toContainText('You’ve seen all the prepared explanations for this step.');
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  await page.getByRole('button', { name: 'Start activity' }).click();
  await page.getByRole('button', { name: 'Next instruction', exact: true }).click();
  await saved(page);
  await page.reload();
  await unlock(page);
  await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Try it — Instruction 2 of 4' })).toBeVisible();
  await page.getByRole('button', { name: 'Next instruction', exact: true }).click();
  await page.getByRole('button', { name: 'Next instruction', exact: true }).click();
  await page.getByRole('button', { name: 'See why it works' }).click();
  await page.getByRole('button', { name: 'Done — return to teacher' }).click();
  await expect(page.getByRole('article', { name: 'Original', exact: true })).toHaveAttribute('data-variant-id','refraction-original');
  await ask(page,'Why does the pencil look broken?');
  await expect(page.locator('.answer')).toContainText('The pencil is straight.');
  await ask(page,queuedDemoQuestion);
  await expect(page.locator('.answer')).toContainText('I do not have a prepared answer');
  await ask(page,'How does a rainbow form?');
  await page.getByRole('button', { name: 'Take my quiz' }).click();
  await expect(page.getByRole('heading', { name: 'How does light travel in a uniform medium?' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Light changes direction at the angled water-air boundary', exact: true }).click();
  await expect(page.locator('.quiz-card').getByText(/You’ve got it/)).toBeVisible();
  await saved(page);
  await fit(page);
  await page.screenshot({ path: info.outputPath('student-offline.png'), fullPage:true });
  const progressDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my progress' }).click();
  const progressPath = (await progressDownload).path();
  expect(await readFile((await progressPath)!,'utf8')).not.toContain('rainbow');
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await unlock(page,'student-b1c2d3e4','222222');
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  const choices = await page.getByRole('group', { name:'Explanation choices' }).getByRole('button').allTextContents();
  expect(choices[0]).toBe('Step by step');
  await ask(page,'can you say it differently');
  await expect(page.locator('.content-card[data-variant-id]')).toHaveAttribute('data-variant-id', 'refraction-original');
  await expect(page.getByRole('heading', { name: 'Your saved questions' })).toHaveCount(0);
  await saved(page);
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await unlock(page);
  await expect(page.getByRole('heading', { name: queuedDemoQuestion })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as {__networkAttempts:string[]}).__networkAttempts)).toEqual([]);

  await context.setOffline(false);
  await teacher.getByLabel('Learner’s six-digit PIN').fill('111111');
  await teacher.getByLabel('Import encrypted progress').setInputFiles((await progressPath)!);
  await expect(teacher.getByText('Progress imported. Class insights updated.')).toBeVisible();
  await expect(teacher.getByText('13 / 19 learners paused or asked an unmatched question')).toBeVisible();
  await teacher.getByLabel('Import encrypted progress').setInputFiles((await progressPath)!);
  await expect(teacher.getByRole('alert')).toContainText('already imported');
  await teacher.getByText('Review imported queued questions', { exact:true }).click();
  await teacher.getByRole('button', { name: 'Run simulated answer return' }).click();
  const returnedDownload = teacher.waitForEvent('download');
  await teacher.getByRole('button', { name: 'Export returned answers' }).click();
  await page.getByLabel('Import returned answers').setInputFiles((await (await returnedDownload).path())!);
  await expect(page.getByText('Simulated returned answer', {exact:true})).toBeVisible();
  await expect(page.locator('.queued')).toContainText('Use a clear plastic cup, never glass.');
  await expect(page.locator('.queued')).toContainText('Pending');
  await teacher.screenshot({path:info.outputPath('teacher-insights.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('bundled collection survives closing the tab and locks learner progress', async ({page,context}) => {
  await page.goto('/'); await unlock(page);
  await page.getByRole('button',{name:'Collect demo lesson'}).click();
  await page.getByRole('button',{name:'Next lesson step'}).click();
  await page.getByRole('button',{name:'Pause here / explain again'}).click();
  await saved(page); await expect(page.getByText('Ready offline',{exact:true})).toBeVisible();
  await context.setOffline(true); await page.close();
  const reopened = await context.newPage(); await reopened.goto('http://127.0.0.1:4273/');
  await unlock(reopened,'student-a1b2c3d4','222222');
  await expect(reopened.getByRole('alert')).toContainText('Cannot unlock');
  await unlock(reopened);
  await expect(reopened.locator('[data-step-id]')).toHaveAttribute('data-step-id','step-refraction');
  await expect(reopened.getByRole('article',{name:'Short',exact:true})).toBeVisible();
});

test('rejects wrong profile, corrupt transfer, unsupported sources, and fits narrow layouts', async ({page,context}) => {
  await page.setViewportSize({width:320,height:720});
  await page.goto('/'); await fit(page); await unlock(page);
  const foreign = await encryptPayload(demoLessons()[1],'111111');
  await page.getByLabel('Import lesson file').setInputFiles({name:'foreign.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(foreign))});
  await expect(page.getByRole('alert')).toContainText('different profile');
  await page.getByLabel('Import lesson file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(page.getByRole('alert')).toContainText('valid Coteacher JSON');
  await page.getByRole('button',{name:'Collect demo lesson'}).click(); await saved(page); await fit(page);
  const teacher = await context.newPage(); await teacher.setViewportSize({width:320,height:720});
  await teacher.goto('http://127.0.0.1:4274'); await fit(teacher);
  await teacher.getByRole('button',{name:'Use reviewed demo materials'}).click();
  await teacher.getByLabel('Teacher notes (.md / .txt)').setInputFiles({name:'unsupported.md',mimeType:'text/plain',buffer:Buffer.from('Teach algebra')});
  await teacher.getByRole('button',{name:'Generate simulated lesson'}).click();
  await expect(teacher.getByRole('alert')).toContainText('supports only');
  await teacher.getByRole('button',{name:'Class insights'}).click(); await fit(teacher);
});

test('storage failure is visible and does not claim readiness', async ({page}) => {
  await page.addInitScript(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Storage full','QuotaExceededError'); }; });
  await page.goto('/'); await unlock(page);
  await page.getByRole('button',{name:'Collect demo lesson'}).click();
  await expect(page.getByText('Not saved — retry before leaving',{exact:true})).toBeVisible();
  await expect(page.getByText('Ready offline',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Export my progress'})).toBeDisabled();
});
