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
    const nativeEncoder = window.AudioEncoder;
    let activeEncoder: AudioEncoder | undefined;
    window.AudioEncoder = class extends nativeEncoder {
      constructor(options: AudioEncoderInit) { super(options); activeEncoder = this; }
    };
    const encoder = await helper.createOpusEncoder();
    const count = 48000 * 121;
    try {
      for (let start = 0; start < count; start += 4096) {
        // This synthetic producer runs much faster than a microphone. Respect
        // the real codec queue rather than overflowing the device safety budget.
        while (activeEncoder!.encodeQueueSize > 200) await new Promise(resolve => setTimeout(resolve, 10));
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
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 15000;
        const check = () => {
          if (audio.currentTime > 120.1) resolve();
          else if (performance.now() >= deadline) reject(new Error('Native audio did not advance after seeking'));
          else setTimeout(check, 50);
        };
        check();
      });
      audio.pause();
      const time = audio.currentTime;
      await context.close();
      const valid = helper.checkOpusContainer(bytes, durationMs);
      const corrupt = bytes.slice(); corrupt[corrupt.length - 1] ^= 1;
      return { durationMs, bytes: bytes.length, decodedDuration: decoded.duration, rms: Math.sqrt(energy / samples.length), duration, time,
        valid, corruptRejected: !helper.checkOpusContainer(corrupt, durationMs) };
    } finally { encoder.close(); window.AudioEncoder = nativeEncoder; }
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

test('native Opus preserves complete audio at arbitrary stop sample boundaries', async ({ page }, info) => {
  test.setTimeout(90_000);
  const bundle = await build({ stdin: { contents: "export {createOpusEncoder} from './apps/teacher/src/opus-encoder';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'BoundaryEncoding', platform: 'browser' });
  await page.goto('http://127.0.0.1:4274');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(async () => {
    const helper = (window as any).BoundaryEncoding;
    const reports: { count: number; durationMs?: number; decodedFrames?: number; error?: string;
      packets: { duration: number | null; toc: number; skip?: number }[] }[] = [];
    // AudioWorklet render quanta are 128 samples; cover every remainder against
    // the configured 960-sample Opus frame, not only whole-second recordings.
    for (const count of Array.from({ length: 15 }, (_, index) => 48000 + index * 128)) {
      const nativeEncoder = window.AudioEncoder;
      const packets: { duration: number | null; toc: number; skip?: number }[] = [];
      window.AudioEncoder = class extends nativeEncoder {
        constructor(options: AudioEncoderInit) {
          super({ ...options, output: (chunk, metadata) => {
            const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes);
            const description = metadata?.decoderConfig?.description;
            const header = description && (ArrayBuffer.isView(description) ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength) : new Uint8Array(description));
            packets.push({ duration: chunk.duration, toc: bytes[0], skip: header && new DataView(header.buffer, header.byteOffset, header.byteLength).getUint16(10, true) });
            options.output(chunk, metadata);
          } });
        }
      };
      const encoder = await helper.createOpusEncoder();
      try {
        for (let start = 0; start < count;) {
          // Pause flushes a partial worklet buffer before later full buffers.
          const length = Math.min(start === 20480 ? (count - 48000 || 128) : 4096, count - start);
          encoder.add(Float32Array.from({ length }, (_, index) => Math.sin((start + index) * Math.PI * 440 / 24000) * .25));
          start += length;
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        const { bytes, durationMs } = await encoder.finish();
        const context = new AudioContext({ sampleRate: 48000 });
        const decoded = await context.decodeAudioData(bytes.buffer.slice(0));
        reports.push({ count, durationMs, decodedFrames: decoded.length, packets });
        await context.close();
      } catch (error) { reports.push({ count, error: String(error), packets }); }
      finally { encoder.close(); window.AudioEncoder = nativeEncoder; }
    }
    return reports;
  });
  await info.attach('native-opus-stop-boundaries', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  console.log('Native stop samples:', results.map(result => ({ count: result.count, error: result.error,
    decodedFrames: result.decodedFrames, packetSamples: result.packets.reduce((sum, packet) => sum + (packet.duration ?? 20000) * 48 / 1000, 0),
    preSkip: result.packets[0]?.skip })));
  for (const result of results) {
    expect(result, JSON.stringify(result)).not.toHaveProperty('error');
    expect(result.durationMs).toBe(Math.floor(result.count / 48));
    expect(result.decodedFrames).toBe(result.count);
  }
});
