import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { activityCaptions, demoLessons, quizCaption, quizFeedback } from '@coteacher/shared';

const lesson = demoLessons()[0];
async function unlock(page: Page, profile = 'student-a1b2c3d4', pin = '111111') {
  await page.getByLabel('Your profile').selectOption(profile);
  await page.getByLabel('Six-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Unlock my profile' }).click();
}
async function ask(page: Page, text: string) {
  await page.getByLabel('Type your question').fill(text);
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
}
async function setup(page: Page, context: BrowserContext) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const attempts: string[] = [];
    Object.defineProperty(window, '__voiceNetwork', { value: attempts });
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, key, { value: () => { attempts.push(key); throw new Error('Forbidden student network API'); } });
  });
  await page.goto('/'); await unlock(page);
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.getByText('Ready offline', { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller ? undefined : new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))));
  await context.setOffline(true);
  return async () => {
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __voiceNetwork: string[] }).__voiceNetwork)).toEqual([]);
  };
}
async function playing(page: Page, caption: string) {
  await expect(page.locator('.spoken-caption')).toHaveText(caption);
  await expect(page.locator('.narration-status')).toHaveAttribute('data-backend', 'clip');
  // Real decoded media, no Audio/play/clock stubs. The service worker serves MP3.
  await expect.poll(() => page.locator('[data-narration-audio]').evaluate((element: HTMLAudioElement) => !element.paused && element.currentTime > 0 && element.duration > 0)).toBe(true);
}

test('real clips speak explanations, questions, quiz and each activity instruction offline', async ({ page, context }) => {
  test.setTimeout(90000);
  const clean = await setup(page, context);
  const first = lesson.concepts[0].variants[0];
  await expect(page.locator('.spoken-caption')).toHaveText(first.content);
  await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
  await playing(page, first.content);
  await page.getByRole('button', { name: 'Pause audio', exact: true }).click();
  await expect(page.locator('[data-narration-audio]')).toHaveJSProperty('paused', true);
  await expect(page.locator('.spoken-caption')).toHaveText(first.content);
  await page.getByLabel('Speech speed').selectOption('1.25');
  await page.getByRole('button', { name: 'Play audio', exact: true }).click();
  await expect(page.locator('[data-narration-audio]')).toHaveJSProperty('playbackRate', 1.25);
  await ask(page, 'pause audio');
  await expect(page.locator('[data-narration-audio]')).toHaveJSProperty('paused', true);
  await ask(page, 'repeat that'); await playing(page, first.content);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await playing(page, lesson.concepts[1].variants[0].content);
  await ask(page, 'show me another explanation');
  await playing(page, lesson.concepts[1].variants[1].content);
  await ask(page, 'Why does the pencil look broken?'); await playing(page, lesson.questionBank[0].answer);
  await expect(page.locator('.narrator .sources')).toContainText('teacher-notes.md');
  await ask(page, 'The bit with the water still makes no sense');
  await playing(page, lesson.matcher.noMatchMessage);
  await expect(page.locator('.queued h3')).toHaveText(['The bit with the water still makes no sense']);
  await ask(page, 'Why do we repeat the experiment?'); await playing(page, lesson.matcher.noMatchMessage);
  await expect(page.locator('.help-response')).toHaveCount(0);
  await ask(page, 'check my understanding');
  const quiz = lesson.quiz[1]; await playing(page, quizCaption(quiz));
  await page.getByRole('button', { name: quiz.options[quiz.correctIndex], exact: true }).click();
  await playing(page, quizFeedback(quiz, true));
  await page.getByRole('button', { name: quiz.options[1 - quiz.correctIndex], exact: true }).click();
  await playing(page, quizFeedback(quiz, false));
  await ask(page, 'start the activity');
  const activity = lesson.concepts[1].variants.find(v => v.type === 'tryit')!;
  if (activity.type !== 'tryit') throw new Error('Expected a Try it');
  await playing(page, activity.content);
  // Let the complete preparation queue finish naturally before the activity.
  await page.getByLabel('Speech speed').selectOption('1.5');
  await expect(page.locator('.spoken-caption')).toHaveText(activityCaptions(activity, { phase: 'intro', instructionIndex: 0 })[1], { timeout: 20000 });
  await expect(page.locator('.spoken-caption')).toHaveText(activityCaptions(activity, { phase: 'intro', instructionIndex: 0 })[2], { timeout: 20000 });
  await page.getByRole('button', { name: 'Start activity' }).click();
  for (let instructionIndex = 0; instructionIndex < activity.steps.length; instructionIndex++) {
    await playing(page, activityCaptions(activity, { phase: 'steps', instructionIndex })[0]);
    await page.getByRole('button', { name: instructionIndex + 1 === activity.steps.length ? 'See why it works' : 'Next instruction', exact: true }).click();
  }
  await playing(page, activityCaptions(activity, { phase: 'why', instructionIndex: 3 })[0]);
  await page.getByRole('button', { name: 'Done — return to teacher' }).click();
  await playing(page, lesson.concepts[1].variants[0].content);
  await page.getByRole('button', { name: 'Replay audio', exact: true }).click();
  await playing(page, lesson.concepts[1].variants[0].content);
  await page.getByRole('button', { name: 'Lock / switch learner' }).click();
  await expect(page.locator('[data-narration-audio]')).toHaveCount(0);
  await unlock(page, 'student-b1c2d3e4', '222222');
  await page.getByRole('button', { name: 'Collect demo lesson' }).click();
  await expect(page.locator('[data-narration-audio]')).toHaveJSProperty('paused', true);
  await expect(page.getByRole('button', { name: 'Enable narration', exact: true })).toBeVisible();
  await expect(page.locator('.spoken-caption')).toHaveText(first.content);
  await clean();
});

test('offline reload retains captions and clips; microphone fallback cancels playback', async ({ page, context }) => {
  const clean = await setup(page, context);
  await page.reload(); await unlock(page);
  await page.getByRole('button', { name: 'Enable narration', exact: true }).click();
  await playing(page, lesson.concepts[0].variants[0].content);
  await page.getByRole('button', { name: 'Hold to talk', exact: true }).tap();
  await playing(page, 'Offline voice is unavailable on this device. Please type your question.');
  await page.getByRole('button', { name: 'Turn narration off', exact: true }).click();
  await expect(page.locator('[data-narration-audio]')).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await expect(page.locator('.spoken-caption')).toHaveText(lesson.concepts[1].variants[0].content);
  await expect(page.locator('[data-narration-audio]')).toHaveJSProperty('paused', true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await clean();
});
