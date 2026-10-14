import { expect, test, type Locator } from '@playwright/test';

export async function assertWatermark(visual: Locator) {
  const svg = visual.locator('svg').first();
  await expect(svg).toHaveAttribute('data-motion-loop-ms', '5000');
  await expect(svg.locator('[data-watermark=Coteacher]')).toHaveCount(1);
  expect(await svg.evaluate(element => {
    const watermark = element.querySelector<SVGGElement>('[data-watermark=Coteacher]')!.getBoundingClientRect();
    const frame = element.getBoundingClientRect();
    const textClear = [...element.querySelectorAll('text')].filter(text => !text.closest('[data-watermark]'))
      .every(text => text.getBoundingClientRect().bottom <= watermark.top + 1);
    return textClear && watermark.left >= frame.left && watermark.top >= frame.top && watermark.right <= frame.right + 1 && watermark.bottom <= frame.bottom + 1;
  })).toBe(true);
}
export async function assertPlaybackMotion(audio: Locator, visual: Locator, cueOffsetMs = 0) {
  const svg = visual.locator('svg').first();
  await audio.evaluate((element: HTMLAudioElement, offset) => { element.pause(); element.currentTime = offset / 1000 + .8; }, cueOffsetMs);
  await expect.poll(async () => Number(await svg.getAttribute('data-motion-phase'))).toBeCloseTo(.16, 2);
  const first = await svg.getAttribute('data-motion-phase');
  const early = await svg.locator('[data-build]').evaluateAll(elements => elements.map(element => element.getAttribute('data-build-progress')));
  expect(early.some(progress => progress === '0.0000')).toBe(true);
  await expect(svg.locator('path[data-build=ray]')).toHaveAttribute('stroke-dashoffset', '100');
  await expect(svg.locator('path[data-build=ray]')).toHaveAttribute('opacity', '0');
  const identity = await visual.getAttribute('data-visual-asset-id') ?? 'classroom';
  await svg.screenshot({ path: test.info().outputPath(`explainer-${identity}-building.png`), animations: 'allow' });
  await audio.evaluate((element: HTMLAudioElement, offset) => { element.currentTime = offset / 1000 + 4.5; }, cueOffsetMs);
  await expect.poll(async () => Number(await svg.getAttribute('data-motion-phase'))).toBeCloseTo(.9, 2);
  const complete = await svg.locator('[data-build]').evaluateAll(elements => elements.every(element => element.getAttribute('data-build-progress') === '1.0000'));
  expect(complete).toBe(true);
  await expect(svg.locator('path[data-build=ray]')).toHaveAttribute('stroke-dashoffset', '0');
  expect(await svg.locator('[data-build=label] text').evaluateAll(elements => elements.every(element => !element.hasAttribute('clip-path')))).toBe(true);
  await svg.screenshot({ path: test.info().outputPath(`explainer-${identity}-complete.png`), animations: 'allow' });
  await audio.evaluate((element: HTMLAudioElement, offset) => { element.currentTime = offset / 1000 + 5.8; }, cueOffsetMs);
  await expect.poll(async () => Number(await svg.getAttribute('data-motion-phase'))).toBeCloseTo(.16, 2);
  expect(await svg.getAttribute('data-motion-phase')).toBe(first);
  expect(await svg.locator('[data-build]').evaluateAll(elements => elements.map(element => element.getAttribute('data-build-progress')))).toEqual(early);
  await new Promise(resolve => setTimeout(resolve, 350));
  expect(await svg.getAttribute('data-motion-phase')).toBe(first);
  await assertWatermark(visual);
}
