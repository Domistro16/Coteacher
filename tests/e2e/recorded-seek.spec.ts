import { expect, test } from '@playwright/test';
import { cueForStep, encryptPayload, personalizedReplay, requirePublishedLesson } from '@coteacher/shared';
import { schoolRecording } from '../school-fixture';
import { openPreparedCompatibility } from './compatibility';

test('native chapter seek keeps the exact millisecond cue after browser time quantization', async ({ page }) => {
  test.setTimeout(60000);
  // A decodable synthetic Opus fixture isolates the media-clock boundary. This
  // test makes no microphone or audibility claim.
  const { lesson } = schoolRecording();
  const recording = structuredClone(lesson.recording!);
  recording.cues[1] = cueForStep(lesson, 'step-refraction', 1003);
  const prepared = requirePublishedLesson(personalizedReplay(lesson, recording));
  await page.goto('/');
  await page.getByLabel('Your profile').selectOption('student-a1b2c3d4');
  await page.getByLabel('Six-digit PIN').fill('111111');
  await page.getByRole('button', { name: 'Unlock my profile', exact: true }).click();
  await openPreparedCompatibility(page);
  await page.getByLabel('Import lesson file').setInputFiles({
    name: 'simulated-clock-boundary.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(await encryptPayload(prepared, '111111'))),
  });
  const player = page.getByRole('region', { name: 'Recorded classroom lesson', exact: true });
  const audio = player.locator('audio');
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Number.isFinite(element.duration))).toBe(true);
  await page.locator('.chapters button[data-concept-id="refraction"]').click();
  await expect(audio).toHaveJSProperty('seeking', false);
  await expect(player).toHaveAttribute('data-recorded-concept-id', 'refraction');
  expect(await audio.evaluate((element: HTMLAudioElement) => element.currentTime * 1000)).toBeCloseTo(1003, 2);
  // A genuinely earlier millisecond must still resolve to the previous chapter.
  await audio.evaluate((element: HTMLAudioElement) => { element.currentTime = 1.002; });
  await expect(audio).toHaveJSProperty('seeking', false);
  await expect(player).toHaveAttribute('data-recorded-concept-id', 'light-path');
});
