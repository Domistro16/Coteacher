import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { demoLessons, preparedNarrationTexts, quizFeedback } from '@coteacher/shared';
import { createNarration, initialNarrationState, type NarrationState } from '../apps/student/src/narration';
import { preparedClip } from '../apps/student/src/Narrator';
import manifest from '../fixtures/demo-lesson/narration.json';

afterEach(() => vi.useRealTimers());
function harness(clips = true, voices: SpeechSynthesisVoice[] = []) {
  let state: NarrationState = initialNarrationState;
  const audio = { src: '', playbackRate: 1, onended: null, onerror: null, pause: vi.fn(), play: vi.fn(async () => {}) } as unknown as HTMLAudioElement;
  const utterances: SpeechSynthesisUtterance[] = [];
  const events = new EventTarget();
  const synth = { getVoices: vi.fn(() => voices), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => utterances.push(utterance)),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) } as unknown as SpeechSynthesis;
  const engine = createNarration({ audio, synthesis: synth, utterance: text => ({ text } as SpeechSynthesisUtterance),
    clip: text => clips ? `/audio/${text}.mp3` : undefined }, next => { state = next; });
  return { audio, synth, engine, utterances, events, get state() { return state; } };
}
const localVoice = { name: 'Local narrator', lang: 'en-NG', localService: true } as SpeechSynthesisVoice;
const remoteVoice = { name: 'Remote narrator', lang: 'en-US', localService: false } as SpeechSynthesisVoice;

describe('sequential offline narration', () => {
  it('keeps captions visible until the learner enables narration once', () => {
    const h = harness(); h.engine.load(['first', 'second']);
    expect(h.state).toMatchObject({ caption: 'first', enabled: false, status: 'off', total: 2 });
    expect(h.audio.play).not.toHaveBeenCalled();
    h.engine.play(); expect(h.state).toMatchObject({ caption: 'first', enabled: true, status: 'playing', backend: 'clip' });
    h.engine.load(['new response']); expect(h.audio.src).toBe('/audio/new response.mp3');
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });
  it('plays each response segment in order and retains the final caption', () => {
    const h = harness(); h.engine.load(['no match', 'related explanation']); h.engine.play();
    h.audio.onended?.call(h.audio, new Event('ended'));
    expect(h.state).toMatchObject({ caption: 'related explanation', index: 1, status: 'playing' });
    h.audio.onended?.call(h.audio, new Event('ended'));
    expect(h.state).toMatchObject({ caption: 'related explanation', status: 'complete' });
    h.engine.replay(); expect(h.state.caption).toBe('no match');
  });
  it('pauses/resumes media and applies bounded speed controls', () => {
    const h = harness(); h.engine.load(['text']); h.engine.play(); h.engine.pause();
    expect(h.state.status).toBe('paused'); expect(h.audio.pause).toHaveBeenCalled();
    h.engine.play(); expect(h.state.status).toBe('playing');
    h.engine.setRate(1.25); expect(h.audio.playbackRate).toBe(1.25);
    h.engine.setRate(20); expect(h.state.rate).toBe(1.5);
    h.engine.setRate(Number.NaN); expect(h.state.rate).toBe(1.5);
  });
  it('rejects stale completions when another explanation replaces the old one', () => {
    const h = harness(); h.engine.load(['old', 'stale']); h.engine.play();
    const oldEnd = h.audio.onended!; h.engine.load(['new']); oldEnd.call(h.audio, new Event('ended'));
    expect(h.state).toMatchObject({ caption: 'new', index: 0, status: 'playing' });
  });
  it('uses only a local English synthesis voice for text without clips', () => {
    const h = harness(false, [remoteVoice, localVoice]); h.engine.load(['newly returned answer']); h.engine.play();
    expect(h.audio.play).not.toHaveBeenCalled();
    expect(h.utterances[0]).toMatchObject({ text: 'newly returned answer', voice: localVoice, rate: 1 });
    expect(h.state.backend).toBe('synthesis');
    h.engine.pause(); expect(h.synth.pause).toHaveBeenCalled();
    h.engine.play(); expect(h.synth.resume).toHaveBeenCalled();
    h.engine.setRate(0.75); expect(h.utterances.at(-1)?.rate).toBe(0.75);
  });
  it('waits for local voices to load and handles voiceschanged', () => {
    vi.useFakeTimers(); const voices: SpeechSynthesisVoice[] = []; const h = harness(false, voices);
    h.engine.load(['caption']); h.engine.play(); expect(h.state.status).toBe('waiting');
    voices.push(localVoice); h.events.dispatchEvent(new Event('voiceschanged'));
    expect(h.state.status).toBe('playing'); vi.advanceTimersByTime(2000);
    expect(h.state.status).toBe('playing');
  });
  it('never uses a remote-only voice; captions survive unavailable speech', () => {
    vi.useFakeTimers(); const h = harness(false, [remoteVoice]); h.engine.load(['caption']); h.engine.play();
    vi.advanceTimersByTime(1200); expect(h.synth.speak).not.toHaveBeenCalled();
    expect(h.state).toMatchObject({ caption: 'caption', status: 'unavailable' });
  });
  it('falls back to local synthesis if a prepared clip fails', async () => {
    const h = harness(true, [localVoice]); vi.mocked(h.audio.play).mockRejectedValueOnce(new Error('decode'));
    h.engine.load(['caption']); h.engine.play(); await Promise.resolve();
    expect(h.utterances[0]?.text).toBe('caption'); expect(h.state.backend).toBe('synthesis');
  });
  it('does not restart narration on a late media failure while the microphone has paused it', async () => {
    const h = harness(true, [localVoice]);
    let reject!: (reason: unknown) => void;
    vi.mocked(h.audio.play).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    h.engine.load(['caption', 'next']); h.engine.play(); h.engine.pause();
    h.audio.onerror?.call(h.audio, new Event('error')); reject(new Error('decode')); await Promise.resolve();
    h.audio.onended?.call(h.audio, new Event('ended'));
    expect(h.state).toMatchObject({ caption: 'caption', status: 'paused' });
    expect(h.synth.speak).not.toHaveBeenCalled();
  });
  it('handles both media error callbacks and play rejection without overlapping synthesis', async () => {
    const h = harness(true, [localVoice]); vi.mocked(h.audio.play).mockRejectedValueOnce(new Error('decode'));
    h.engine.load(['caption']); h.engine.play(); h.audio.onerror?.call(h.audio, new Event('error')); await Promise.resolve();
    expect(h.synth.speak).toHaveBeenCalledTimes(1);
  });
  it('applies a changed speed when resuming paused synthesis', () => {
    const h = harness(false, [localVoice]); h.engine.load(['caption']); h.engine.play(); h.engine.pause();
    h.engine.setRate(1.25); expect(h.state.status).toBe('ready'); h.engine.play();
    expect(h.utterances.at(-1)?.rate).toBe(1.25);
  });
  it('does not pretend blocked autoplay succeeded', async () => {
    const h = harness(); vi.mocked(h.audio.play).mockRejectedValueOnce({ name: 'NotAllowedError' });
    h.engine.load(['caption']); h.engine.play(); await Promise.resolve();
    expect(h.state).toMatchObject({ caption: 'caption', status: 'ready' });
    expect(h.state.message).toContain('Press Play');
  });
  it('cancels pending voice startup on microphone pause, disable and disposal', () => {
    vi.useFakeTimers(); const voices: SpeechSynthesisVoice[] = []; const h = harness(false, voices);
    h.engine.load(['private caption']); h.engine.play(); h.engine.pause();
    voices.push(localVoice); h.events.dispatchEvent(new Event('voiceschanged')); vi.advanceTimersByTime(1500);
    expect(h.synth.speak).not.toHaveBeenCalled();
    h.engine.play(); h.engine.disable(); expect(h.state.enabled).toBe(false);
    const stale = h.utterances[0].onend!; h.engine.dispose(); stale.call(h.utterances[0], new Event('end') as SpeechSynthesisEvent);
    h.engine.play(); expect(h.utterances).toHaveLength(1);
  });
});

describe('prepared audio content', () => {
  it('covers every fixed caption and packages existing audioAssetPath references', async () => {
    let total = 0;
    for (const [text, path] of Object.entries(manifest.clips)) {
      expect(path).toBe(`audio/${createHash('sha256').update(text).digest('hex').slice(0, 20)}.mp3`);
      const bytes = await readFile(`apps/student/public/${path}`);
      expect(bytes.length).toBeGreaterThan(100);
      total += bytes.length;
    }
    expect(total).toBeLessThan(2 * 1024 * 1024);
    for (const lesson of demoLessons()) {
      for (const caption of preparedNarrationTexts(lesson)) expect(preparedClip(caption)).toBeTruthy();
      for (const concept of lesson.concepts) for (const variant of concept.variants) {
        expect(variant.audioAssetPath).toBe((manifest.clips as Record<string, string>)[variant.content]);
        expect((await stat(`apps/student/public/${variant.audioAssetPath}`)).size).toBeGreaterThan(100);
      }
      for (const quiz of lesson.quiz) for (const correct of [true, false]) expect(preparedClip(quizFeedback(quiz, correct))).toBeTruthy();
    }
    expect(preparedClip('Text without a prepared clip')).toBeUndefined();
  });
});
