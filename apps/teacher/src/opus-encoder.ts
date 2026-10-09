import { OpusContainer } from '@coteacher/shared';

/** Streaming PCM → compressed packets. Retains compressed bytes, never a full PCM lesson. */
export async function createOpusEncoder() {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') throw new Error('Compressed recording needs a browser with WebCodecs Opus encoding. Use current Chrome or Edge on HTTPS or localhost.');
  const config: AudioEncoderConfig = { codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 24000,
    opus: { format: 'opus', frameDuration: 20000, complexity: 5 } };
  if (!(await AudioEncoder.isConfigSupported(config)).supported) throw new Error('This browser cannot encode mono Opus. Use current Chrome or Edge for teacher recording.');
  const container = new OpusContainer();
  let samples = 0, energy = 0, failure: Error | undefined;
  const encoder = new AudioEncoder({ error: error => { failure = error; }, output: (chunk, metadata) => {
    try { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); container.add(bytes, chunk.duration ?? 20000, metadata?.decoderConfig?.description); }
    catch (error) { failure = error as Error; }
  } });
  encoder.configure(config);
  return {
    add(chunk: Float32Array<ArrayBuffer>) {
      if (failure) throw failure;
      if (encoder.encodeQueueSize > 100) throw new Error('This device cannot encode audio fast enough. This attempt was not saved; try closing other apps.');
      for (const value of chunk) energy += value * value;
      const frame = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: chunk.length,
        numberOfChannels: 1, timestamp: Math.round(samples * 1_000_000 / 48000), data: chunk });
      samples += chunk.length;
      try { encoder.encode(frame); } finally { frame.close(); }
    },
    async finish() {
      await encoder.flush(); if (failure) throw failure;
      if (!samples || Math.sqrt(energy / samples) <= .0001) throw new Error('No audible microphone signal was captured. Check the input and record again; a silent slideshow cannot be published.');
      return { bytes: container.finish(samples, 48000), durationMs: Math.floor(samples / 48) };
    },
    close() { if (encoder.state !== 'closed') encoder.close(); },
  };
}
