import { afterEach, expect, it, vi } from 'vitest';
import { createSpeechInput } from '../apps/student/src/speech';

afterEach(() => vi.unstubAllGlobals());
it('offers typing without trying network recognition when local capability is missing', async () => {
  const forbidden = vi.fn();
  vi.stubGlobal('window',{ webkitSpeechRecognition: forbidden });
  const status = vi.fn();
  await createSpeechInput().start(vi.fn(),status);
  expect(forbidden).not.toHaveBeenCalled(); expect(status).toHaveBeenCalledWith(expect.stringContaining('Please type'));
});
it('does not start recording after the learner releases during availability checking', async () => {
  let resolve!: (value:string) => void;
  const construct = vi.fn();
  class Recognition {
    constructor() { construct(); }
    static available = () => new Promise<string>(r => { resolve = r; });
  }
  vi.stubGlobal('window',{SpeechRecognition:Recognition});
  const speech = createSpeechInput();
  const pending = speech.start(vi.fn(),vi.fn()); speech.stop(); resolve('available'); await pending;
  expect(construct).not.toHaveBeenCalled();
});
it('requests only local processing, stops listening on release, and rejects uncertain transcripts', async () => {
  const start = vi.fn(); const stop = vi.fn(); let instance!: Recognition;
  class Recognition {
    processLocally = false; lang=''; continuous=false; interimResults=false;
    onresult: ((event: {results:{[n:number]:{[n:number]:{transcript:string;confidence:number}}}}) => void) | null = null;
    onerror: (() => void) | null = null;
    start = start; stop = stop;
    constructor() { instance = this; }
    static available = vi.fn(async () => 'available');
  }
  vi.stubGlobal('window',{SpeechRecognition:Recognition});
  const speech = createSpeechInput(); const text = vi.fn(); const status = vi.fn();
  await speech.start(text,status);
  expect(Recognition.available).toHaveBeenCalledWith({langs:['en-US'],processLocally:true});
  expect(instance.processLocally).toBe(true); expect(start).toHaveBeenCalledOnce();
  instance.onresult!({results:{0:{0:{transcript:'unclear',confidence:0.2}}}});
  expect(text).not.toHaveBeenCalled();
  instance.onresult!({results:{0:{0:{transcript:'Why does the pencil look bent?',confidence:0.95}}}});
  expect(text).toHaveBeenCalledWith('Why does the pencil look bent?');
  speech.stop(); expect(stop).toHaveBeenCalledOnce();
});
