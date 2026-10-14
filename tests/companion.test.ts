import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoLessons, matchQuestion } from '@coteacher/shared';
import { companionIntent, isCompanionInterruption, spokenQuizOption } from '../apps/student/src/companion-intent';
import { createVoiceSession, type VoiceSessionState } from '../apps/student/src/voice-session';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('prepared companion language boundaries', () => {
  it('requires the explicit companion name for interruption, not ordinary classroom speech', () => {
    for (const phrase of ["Coteacher, I don't understand this", 'Co teacher, I do not understand this.', 'Co-teacher please explain this']) expect(isCompanionInterruption(phrase)).toBe(true);
    for (const phrase of ["I don't understand this", 'The teacher said I do not understand this', 'Coteacher, why is the Moon bright?', 'Coteacher I understand this']) expect(isCompanionInterruption(phrase)).toBe(false);
  });
  it('keeps confirmations, check offers and return commands separate from actual questions', () => {
    expect(companionIntent('It makes sense now')).toBe('confirm');
    expect(companionIntent('Coteacher, yes I understand')).toBe('confirm');
    expect(companionIntent('Yes, I understand this now')).toBe('confirm');
    expect(companionIntent('Not yet')).toBe('another');
    expect(companionIntent('Quiz me')).toBe('check'); expect(companionIntent('Continue lesson')).toBe('resume');
    for (const question of ['Why do we repeat the experiment?', 'Yes?', 'Why does this quiz matter?', 'Why does the pencil seem crooked in water?']) expect(companionIntent(question)).toBe('question');
  });
  it('matches bounded meaning equivalents without lowering confidence or guessing at unknown terms', () => {
    const lesson = demoLessons()[0];
    for (const query of ['Why does the pencil seem crooked in water?', 'Coteacher, why does the pencil look broken?']) {
      const result = matchQuestion(query, 'step-refraction', lesson);
      expect('match' in result && result.match.id).toBe('question-bent');
      if ('match' in result) { expect(result.score).toBeGreaterThan(lesson.matcher.confidenceThreshold); expect(result.match.sourceRefs.length).toBeGreaterThan(0); }
    }
    for (const query of ['Why does the pencil seem crooked on Mars?', 'Why does the pencil physically snap in water?', 'Could glass hurt me?', 'How does a curved mirror focus light?']) expect(matchQuestion(query, 'step-refraction', lesson)).toHaveProperty('noMatch', true);
  });
  it('opens an offered check for actual conversational requests without treating questions or refusals as acceptance', () => {
    for (const phrase of ['v-very well Yeah, yeah. I would like a quick check on that', 'Yes, I would like a quick check', 'Can we try a short check?', 'I want to try the quiz', 'I want to try a quick check', 'Yeah, I would love to try a quick check']) {
      expect(companionIntent(phrase)).toBe('check');
    }
    for (const phrase of ['Yes, I would like to', 'Yeah', 'Yes', 'Sure, let\'s do it']) {
      expect(companionIntent(phrase, true)).toBe('check');
    }
    expect(companionIntent('Yes')).toBe('confirm');
    expect(companionIntent('Yes, I would like to')).toBe('question');
    for (const phrase of ['Why does this quiz matter?', 'I do not want a quick check', 'Can you explain what a quick check is?', 'Yes?', 'Would you love to try a quick check?', 'I would love to know why light bends']) {
      expect(companionIntent(phrase, true)).toBe('question');
    }
    expect(companionIntent('Not yet', true)).toBe('another');
    expect(companionIntent('Continue lesson', true)).toBe('resume');
  });
  it('accepts only unambiguous available quiz options', () => {
    const options = ['Along a straight path', 'Always along a curved path'];
    expect(spokenQuizOption('Option two', options)).toBe(1);
    expect(spokenQuizOption('Along a straight path', options)).toBe(0);
    expect(spokenQuizOption('Option three', options)).toBeUndefined();
    expect(spokenQuizOption('I think it might be option two or one', options)).toBeUndefined();
  });
});

function harness() {
  const instances: Recognition[] = [];
  class Recognition {
    processLocally = false; lang = ''; continuous = false; interimResults = false;
    onresult: any = null; onerror: any = null; onend: any = null; onstart: any = null;
    start = vi.fn(() => this.onstart?.()); abort = vi.fn();
    constructor() { instances.push(this); }
    static available = vi.fn(async () => 'available');
    result(text: string, confidence = .95, final = true) { this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: final, 0: { transcript: text, confidence } } } }); }
  }
  vi.stubGlobal('window', { SpeechRecognition: Recognition });
  const states: VoiceSessionState[] = [], text = vi.fn(), session = createVoiceSession();
  return { Recognition, instances, session, text, states, start: () => session.start(text, state => states.push(state)) };
}
describe('explicit local voice sessions', () => {
  it('never tries cloud/webkit recognition or downloads a missing recognizer', async () => {
    const forbidden = vi.fn(); vi.stubGlobal('window', { webkitSpeechRecognition: forbidden });
    const state = vi.fn(); await createVoiceSession().start(vi.fn(), state);
    expect(forbidden).not.toHaveBeenCalled(); expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'unavailable' }));
    const h = harness(); h.Recognition.available.mockResolvedValue('downloadable'); await h.start();
    expect(h.instances).toHaveLength(0); expect(h.states.at(-1)?.status).toBe('unavailable');
  });
  it('ignores a capability result returned after the learner disables voice mode', async () => {
    const h = harness(); let resolve!: (value: string) => void;
    h.Recognition.available.mockImplementation(() => new Promise(r => { resolve = r; }));
    const starting = h.start(); h.session.stop(); resolve('available'); await starting;
    expect(h.instances).toHaveLength(0);
  });
  it('delivers only clear final transcripts from a local session, then aborts cleanly', async () => {
    const h = harness(); await h.start(); const active = h.instances[0];
    expect(h.Recognition.available).toHaveBeenCalledWith({ langs: ['en-US'], processLocally: true });
    expect(active).toMatchObject({ processLocally: true, continuous: true, interimResults: false });
    active.result('interim', .99, false); active.result('unclear', .2); expect(h.text).not.toHaveBeenCalled();
    active.result('  Why does the pencil seem crooked?  '); expect(h.text).toHaveBeenCalledWith('  Why does the pencil seem crooked?  ');
    const stale = active.onresult; h.session.stop(); expect(active.abort).toHaveBeenCalledOnce();
    stale({ results: { 0: { 0: { transcript: 'stale question', confidence: .99 } } } }); expect(h.text).toHaveBeenCalledTimes(1);
  });
  it('cancels natural restart timers and ignores errors from the previous recognizer', async () => {
    vi.useFakeTimers(); const h = harness(); await h.start();
    const previous = h.instances[0], staleError = previous.onerror;
    previous.onend(); vi.advanceTimersByTime(250); expect(h.instances).toHaveLength(2);
    staleError({ error: 'not-allowed' }); expect(h.states.at(-1)?.status).toBe('listening');
    h.instances[1].onend(); h.session.stop(); vi.advanceTimersByTime(1000); expect(h.instances).toHaveLength(2);
  });
  it('makes permission failures visible and bounds silent restart loops', async () => {
    const h = harness(); await h.start(); h.instances[0].onerror({ error: 'not-allowed' });
    expect(h.states.at(-1)).toMatchObject({ status: 'unavailable', message: expect.stringContaining('permission') });
    expect(h.instances[0].abort).toHaveBeenCalledOnce();
    vi.useFakeTimers(); const quiet = harness(); await quiet.start();
    for (let i = 0; i < 3; i++) { quiet.instances[i].onend(); vi.advanceTimersByTime(250); }
    expect(quiet.instances).toHaveLength(3); expect(quiet.states.at(-1)?.status).toBe('unavailable');
  });
  it('marks the microphone listening only after the actual recognition start event', async () => {
    const h = harness();
    // Keep permission pending until the browser's actual start event.
    const Original = h.Recognition;
    class PendingPermission extends Original { start = vi.fn(); }
    vi.stubGlobal('window', { SpeechRecognition: PendingPermission });
    await h.start(); expect(h.states.at(-1)?.status).toBe('checking');
    h.instances[0].onstart(); expect(h.states.at(-1)?.status).toBe('listening');
    h.session.stop();
  });
});
