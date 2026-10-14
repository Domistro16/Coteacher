import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

test('streaming native Opus capture exceeds two minutes with complete audible, finite, seekable media', async ({ page }) => {
  test.setTimeout(90_000);
  const bundle = await build({ stdin: { contents: "export {createOpusEncoder} from './apps/teacher/src/opus-encoder'; export {checkOpusContainer} from '@coteacher/shared';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'ReplayEncodingUnderTest', platform: 'browser' });
  await page.goto('http://127.0.0.1:4274');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const helper = (window as any).ReplayEncodingUnderTest;
    const encoder = await helper.createOpusEncoder();
    const count = 48000 * 121;
    try {
      for (let start = 0; start < count; start += 4096) {
        const pcm = Float32Array.from({ length: Math.min(4096, count - start) }, (_, index) => Math.sin((start + index) * Math.PI * 440 / 24000) * .25);
        encoder.add(pcm);
        // Yield to the actual native codec; no mocked audio or timeline time.
        if (start % (4096 * 10) === 0) await new Promise(resolve => setTimeout(resolve, 10));
      }
      const { bytes, durationMs } = await encoder.finish();
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(bytes.buffer.slice(0));
      const samples = decoded.getChannelData(0);
      let energy = 0; for (const value of samples) energy += value * value;
      const audio = document.createElement('audio'); audio.controls = true;
      audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/ogg;codecs=opus' })); document.body.append(audio);
      await new Promise<void>((resolve, reject) => { audio.onloadedmetadata = () => resolve(); audio.onerror = () => reject(new Error('Native playback rejected complete recording')); });
      const duration = audio.duration;
      audio.currentTime = 120;
      await new Promise<void>(resolve => { audio.onseeked = () => resolve(); });
      await audio.play(); await new Promise(resolve => setTimeout(resolve, 350)); audio.pause();
      const time = audio.currentTime;
      await context.close();
      const valid = helper.checkOpusContainer(bytes, durationMs);
      const corrupt = bytes.slice(); corrupt[corrupt.length - 1] ^= 1;
      return { durationMs, bytes: bytes.length, decodedDuration: decoded.duration, rms: Math.sqrt(energy / samples.length), duration, time,
        valid, corruptRejected: !helper.checkOpusContainer(corrupt, durationMs) };
    } finally { encoder.close(); }
  });
  expect(result.durationMs).toBe(121000);
  expect(result.decodedDuration).toBeCloseTo(121, 2);
  expect(result.duration).toBeCloseTo(121, 1);
  expect(result.bytes).toBeLessThan(600000);
  expect(result.rms).toBeGreaterThan(.1);
  expect(result.time).toBeGreaterThan(120.1);
  expect(result.valid).toBe(true); expect(result.corruptRejected).toBe(true);
  await test.info().attach('native-opus-measurements', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});
