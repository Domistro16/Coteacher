import { describe, expect, it } from 'vitest';
import { demoLessons, emptyProgress, matchQuestion, validateProgressRecord, type ProgressRecord } from '@coteacher/shared';
import { detectStudentIntent, handleStudentRequest, nextUnseenExplanation } from '../apps/student/src/help';
import { createPlayerModel, initialPlayerState, reducePlayerState, selectedVariant, transitionPlayer, type PlayerAction } from '../apps/student/src/player';

const timestamp = '2026-10-09T12:00:00.000Z';
const positives = [
  "Pause here. I understand this part, but I don't understand this",
  'explain that again', 'can you say it differently',
  "pause here, I don't get this part", 'Pause here!', 'explain again', 'explain differently',
  "  PAUSE   HERE. I understand this part, but I don’t understand this!!!  ",
  'Please explain that again.', 'Could you put that another way?', 'Break it down.', 'Give me a different example', 'explian again',
];
const negatives = [
  "I'm not lost", "I'm lost in Abuja", 'Where is my lost pencil?', 'How does a rainbow form?',
  "I didn't get that parcel", 'Explain how a rainbow forms again?', 'Can you say how a rainbow forms differently?',
  'This part is not confusing', 'What does confusing mean?', 'Why does the pencil look broken?',
  'Does light travel straight before reaching the water surface?', 'Is the light path straight in one medium?',
  'Pause here. What time is lunch?', "What does 'I'm lost' mean?", 'Explain that again tomorrow',
  "I'm lost", "I didn't get that", 'this part is confusing', 'None of this is clicking for me',
  'Where does the light go after that?', 'Why is the water part different?', 'What does repeat mean?',
  'Why do we try it with water?', 'Tell me about quiz scoring', 'reply', 'quiet', 'repeat tomorrow',
];

function session(index = 0) {
  const lesson = demoLessons()[index];
  const model = createPlayerModel(lesson);
  let player = reducePlayerState(model, initialPlayerState(model), { type: 'navigate', direction: 1 });
  let progress = emptyProgress(lesson);
  progress.events.push({ type: 'variant-viewed', timestamp, conceptId: 'refraction', timelineStepId: 'step-refraction', variantId: player.variantId });
  let serial = 0;
  return {
    lesson, model,
    get player() { return player; }, get progress() { return progress; },
    ask(text: string) {
      const next = handleStudentRequest(model, player, progress, text, timestamp, () => `queued-${++serial}`);
      player = next.player; progress = next.progress;
      expect(validateProgressRecord(progress, lesson).valid).toBe(true);
      return next.response;
    },
    act(action: PlayerAction) {
      const next = transitionPlayer(model, player, action, timestamp);
      player = next.player; progress = { ...progress, events: [...progress.events, ...next.events] };
      expect(validateProgressRecord(progress, lesson).valid).toBe(true);
    },
  };
}

describe('local help intent before matching', () => {
  it.each(positives)('recognizes %s at the current step', text => {
    expect(detectStudentIntent(text)).toMatchObject({ type: 'command', command: 'explain-differently' });
    const s = session();
    const response = s.ask(text);
    expect(response.help).toHaveProperty('variant.id', 'refraction-short');
    expect(s.player.timelineIndex).toBe(1);
    expect(s.progress.queuedQuestions).toEqual([]);
  });
  it.each(negatives)('does not intercept the near-miss/question %s', text => {
    expect(detectStudentIntent(text)).toEqual({ type: 'help', context: text });
    const s = session();
    const response = s.ask(text);
    expect(response.help).toBeUndefined();
    expect(response.question).toBeDefined();
    expect(s.player.variantId).toBe('refraction-original');
    expect(s.progress.events.some(e => e.type === 'explain-again' || e.type === 'pause')).toBe(false);
  });
  it('extracts the suffix, preserving its spelling, without the command scaffolding', () => {
    expect(detectStudentIntent("Pause here. I understand this part, but I don’t understand Why does the pencil look broken?"))
      .toEqual({ type: 'command', command: 'explain-differently', context: 'Why does the pencil look broken' });
  });
  it('answers specific confusion with sources while rotating at the current moment', () => {
    const s = session();
    const response = s.ask("Pause here. I understand this part, but I don't understand Why does the pencil look broken?");
    expect(response.help).toHaveProperty('variant.id', 'refraction-short');
    expect(response.question).toMatchObject({ step: 'step-refraction', refs: s.lesson.questionBank[0].sourceRefs });
    expect(response.question?.text).toContain('The pencil is straight.');
    const expected = matchQuestion('Why does the pencil look broken', 'step-refraction', s.lesson);
    expect(s.progress.events.find(e => e.type === 'question-matched')).toHaveProperty('matcherScore', expected.score);
    expect(s.progress.queuedQuestions).toEqual([]);
  });
  it('can answer from another lesson moment without navigating to it', () => {
    const s = session();
    const response = s.ask("I understand this part, but I don't understand Does light travel straight before reaching the water surface?");
    expect(response.question?.step).toBe('step-light');
    expect(s.player.timelineIndex).toBe(1);
    expect(s.player.variantId).toBe('refraction-short');
    expect(s.progress.events.find(e => e.type === 'question-matched')).toMatchObject({ timelineStepId: 'step-light', conceptId: 'light-path' });
  });
  it('queues only specific unmatched context and keeps all events in one update', () => {
    const s = session();
    const response = s.ask("Pause here. I understand this part, but I don't understand How does a rainbow form?");
    expect(response.help).toHaveProperty('variant.id', 'refraction-short');
    expect(response.question).toMatchObject({ text: s.lesson.matcher.noMatchMessage, refs: [] });
    expect(s.progress.queuedQuestions).toEqual([{ id: 'queued-1', text: 'How does a rainbow form', askedAt: timestamp, timelineStepId: 'step-refraction', answered: false }]);
    expect(s.progress.events.map(e => e.type)).toEqual(['variant-viewed', 'pause', 'explain-again', 'variant-viewed', 'question-no-match']);
  });
  it.each(['this', 'that', 'it', 'this part', 'that part'])('does not queue the generic suffix %s', suffix => {
    const s = session();
    s.ask(`Pause here. I understand this part, but I don't understand ${suffix}`);
    expect(s.progress.queuedQuestions).toEqual([]);
    expect(s.progress.events.some(e => e.type === 'question-no-match')).toBe(false);
  });
  it('does not force low-confidence context into an answer', () => {
    const s = session();
    const response = s.ask("but I don't understand why the pencil tastes broken");
    expect(response.question?.refs).toEqual([]);
    expect(s.progress.events.some(e => e.type === 'question-matched')).toBe(false);
    expect(s.progress.queuedQuestions).toHaveLength(1);
  });
});

describe('unseen explanations from saved profile history', () => {
  it.each([0, 1])('uses learner %s route order then stops honestly', index => {
    const s = session(index);
    const expected = index === 0 ? ['refraction-short', 'refraction-analogy', 'refraction-stepwise']
      : ['refraction-original', 'refraction-short', 'refraction-analogy'];
    for (const id of expected) {
      const response = s.ask('explain again');
      expect(response.help).toHaveProperty('variant.id', id);
      expect(s.player.timelineIndex).toBe(1);
      expect(selectedVariant(s.model, s.player).sourceRefs.length).toBeGreaterThan(0);
    }
    const before = s.player;
    const viewCount = s.progress.events.filter(e => e.type === 'variant-viewed').length;
    expect(s.ask('explain differently').help).toEqual({ exhausted: true });
    expect(s.ask('can you say it differently').help).toEqual({ exhausted: true });
    expect(s.player).toBe(before);
    expect(s.progress.events.filter(e => e.type === 'variant-viewed')).toHaveLength(viewCount);
    expect(s.progress.queuedQuestions).toEqual([]);
  });
  it('counts manually viewed variants even after switching back', () => {
    const s = session();
    s.act({ type: 'select-variant', variantId: 'refraction-short' });
    s.act({ type: 'original' });
    expect(s.ask('explain that again').help).toHaveProperty('variant.id', 'refraction-analogy');
  });
  it('includes unseen refreshers and excludes Try it from rotation', () => {
    const s = session();
    s.act({ type: 'navigate', direction: -1 });
    expect(s.ask('explain again').help).toHaveProperty('variant.id', 'light-refresher');
    expect(s.ask('explain again').help).toEqual({ exhausted: true });
    expect(s.player.variantId).toBe('light-refresher');
  });
  it('survives snapshot reconstruction and navigation without resetting history', () => {
    const s = session();
    s.ask('explain again');
    const restored = JSON.parse(JSON.stringify({ lesson: s.lesson, player: s.player, progress: s.progress }));
    const next = handleStudentRequest(createPlayerModel(restored.lesson), restored.player, restored.progress, 'explain again', timestamp, () => 'queued-restored');
    expect(next.player.variantId).toBe('refraction-analogy');
    s.act({ type: 'navigate', direction: -1 });
    s.act({ type: 'navigate', direction: 1 });
    expect(s.ask('explain again').help).toHaveProperty('variant.id', 'refraction-analogy');
  });
  it('keeps A and B independent and rejects mismatched request histories', () => {
    const a = session(); const b = session(1);
    for (let i = 0; i < 3; i++) a.ask('explain again');
    expect(b.ask('explain again').help).toHaveProperty('variant.id', 'refraction-original');
    expect(nextUnseenExplanation(b.model, b.player, a.progress)?.id).toBe('refraction-stepwise');
    expect(() => handleStudentRequest(b.model, b.player, a.progress, 'explain again', timestamp, () => 'q')).toThrow('different learner');
    expect(a.ask('explain again').help).toEqual({ exhausted: true });
  });
  it('isolates history by exact timeline step even when the concept repeats', () => {
    const s = session(); s.ask('explain again');
    const lesson = structuredClone(s.lesson);
    lesson.timeline.push({ ...lesson.timeline[1], id: 'step-refraction-repeat' });
    const model = createPlayerModel(lesson);
    const player = { ...s.player, timelineIndex: 2, variantId: 'refraction-original' };
    expect(nextUnseenExplanation(model, player, s.progress)?.id).toBe('refraction-short');
  });
  it('records the original displayed by a no-match panel before further help', () => {
    const s = session(1);
    s.ask('How does a rainbow form?');
    expect(s.progress.events).toContainEqual({ type: 'variant-viewed', timestamp, conceptId: 'refraction', timelineStepId: 'step-refraction', variantId: 'refraction-original' });
    expect(s.ask('explain again').help).toHaveProperty('variant.id', 'refraction-short');
  });
  it('records activity completion and the original at its return destination', () => {
    const s = session(1);
    s.act({ type: 'select-variant', variantId: 'refraction-tryit' });
    s.act({ type: 'start-activity' });
    for (let i = 0; i < 4; i++) s.act({ type: 'next-instruction' });
    s.act({ type: 'complete-activity' });
    expect(s.progress.events.slice(-2)).toEqual([
      { type: 'tryit-completed', timestamp, conceptId: 'refraction', timelineStepId: 'step-refraction', variantId: 'refraction-tryit' },
      { type: 'variant-viewed', timestamp, conceptId: 'refraction', timelineStepId: 'step-refraction', variantId: 'refraction-original' },
    ]);
    const response = s.ask("but I don't understand Should I use a glass cup for this activity?");
    expect(response.help).toHaveProperty('variant.id', 'refraction-short');
    expect(s.progress.events.at(-1)).toMatchObject({ type: 'tryit-follow-up', questionId: 'queued-1', text: 'Should I use a glass cup for this activity' });
  });
  it('does not mutate the lesson or supplied state/progress', () => {
    const s = session();
    const before = JSON.stringify({ lesson: s.lesson, player: s.player, progress: s.progress });
    const progress: ProgressRecord = s.progress;
    handleStudentRequest(s.model, s.player, progress, 'explain again', timestamp, () => 'q');
    expect(JSON.stringify({ lesson: s.lesson, player: s.player, progress })).toBe(before);
  });
  it('repairs the current view in sparse histories before rotating away', () => {
    const s = session();
    const sparse = { ...s.progress, events: [] };
    const next = handleStudentRequest(s.model, s.player, sparse, 'explain again', timestamp, () => 'q');
    expect(next.progress.events[0]).toMatchObject({ type: 'variant-viewed', variantId: 'refraction-original' });
    expect(nextUnseenExplanation(s.model, next.player, next.progress)?.id).toBe('refraction-analogy');
  });
});
