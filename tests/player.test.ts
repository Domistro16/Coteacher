import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/demo-lesson/lesson-package.json';
import invalidFixture from '../fixtures/invalid/missing-source-refs.json';
import { demo, loadDemoLesson } from '../apps/student/src/demo';
import {
  initialPlayerState, reducePlayerState, selectedVariant,
  type PlayerAction, type PlayerState,
} from '../apps/student/src/player';

if (!demo.valid) throw new Error('Expected a valid demo player model');
const model = demo.model;
function act(state: PlayerState, action: PlayerAction): PlayerState {
  return reducePlayerState(model, state, action);
}
function atRefraction(): PlayerState {
  return act(initialPlayerState(model), { type: 'navigate', direction: 1 });
}
function atActivity(): PlayerState {
  return act(atRefraction(), { type: 'select-variant', variantId: 'refraction-tryit' });
}
function atWhy(): PlayerState {
  let state = act(atActivity(), { type: 'start-activity' });
  const variant = selectedVariant(model, state);
  if (variant.type !== 'tryit') throw new Error('Expected activity');
  for (const _ of variant.steps) state = act(state, { type: 'next-instruction' });
  return state;
}

describe('fixture-driven lesson player', () => {
  it('validates before exposing a model and rejects invalid or nonsimulated data', () => {
    expect(loadDemoLesson(fixture).valid).toBe(true);
    expect(loadDemoLesson(invalidFixture)).toEqual({ valid: false });
    expect(loadDemoLesson({ ...fixture, simulated: false })).toEqual({ valid: false });
    expect(loadDemoLesson(null)).toEqual({ valid: false });
  });

  it('fails closed if an original explanation is unavailable', () => {
    const value = structuredClone(fixture);
    value.concepts[1].variants[0].type = 'short';
    expect(loadDemoLesson(value)).toEqual({ valid: false });
  });

  it('starts at the first timeline step and does not advance without an action', () => {
    const state = initialPlayerState(model);
    expect(model.steps[state.timelineIndex].step.id).toBe('step-light');
    expect(state.variantId).toBe('light-original');
    expect(state.activity).toBeNull();
  });

  it('uses route variant order and preserves the fixture objective', () => {
    expect(model.steps[1].variants.map(variant => variant.id)).toEqual(fixture.route.conceptRoutes[1].variantOrder);
    expect(model.steps[1].reason).toBe(fixture.route.conceptRoutes[1].reason);
    const before = JSON.stringify(model.lesson);
    act(atActivity(), { type: 'original' });
    expect(JSON.stringify(model.lesson)).toBe(before);
    expect(model.lesson.objective).toEqual(fixture.objective);
  });

  it('respects both timeline boundaries', () => {
    const first = initialPlayerState(model);
    const last = atRefraction();
    expect(act(first, { type: 'navigate', direction: -1 })).toBe(first);
    expect(act(last, { type: 'navigate', direction: 1 })).toBe(last);
  });

  it('selects the destination default when navigating, clearing variant and activity state', () => {
    let state = act(initialPlayerState(model), { type: 'select-variant', variantId: 'light-refresher' });
    state = act(state, { type: 'navigate', direction: 1 });
    expect(state.variantId).toBe('refraction-original');
    state = act(atActivity(), { type: 'navigate', direction: -1 });
    expect(state).toEqual(initialPlayerState(model));
  });

  it('switches explanations within the same step and restores its original', () => {
    const state = act(atRefraction(), { type: 'select-variant', variantId: 'refraction-short' });
    expect(state.timelineIndex).toBe(1);
    expect(selectedVariant(model, state).content).toBe(fixture.concepts[1].variants[1].content);
    expect(act(state, { type: 'original' })).toEqual(atRefraction());
  });

  it('ignores unknown or other-concept variant selections', () => {
    const state = atRefraction();
    expect(act(state, { type: 'select-variant', variantId: 'missing' })).toBe(state);
    expect(act(state, { type: 'select-variant', variantId: 'light-refresher' })).toBe(state);
  });

  it('keeps the refresher optional without adding a timeline detour', () => {
    const first = initialPlayerState(model);
    expect(act(first, { type: 'navigate', direction: 1 })).toEqual(atRefraction());
    const refresher = act(first, { type: 'select-variant', variantId: 'light-refresher' });
    expect(refresher.timelineIndex).toBe(0);
    expect(act(refresher, { type: 'original' })).toEqual(first);
  });

  it('shows preparation before instructions and cannot complete early', () => {
    const intro = atActivity();
    expect(intro.activity?.phase).toBe('intro');
    expect(act(intro, { type: 'complete-activity' })).toBe(intro);
    expect(act(intro, { type: 'next-instruction' })).toBe(intro);
    const started = act(intro, { type: 'start-activity' });
    expect(started.activity).toEqual({ phase: 'steps', instructionIndex: 0 });
    expect(act(started, { type: 'complete-activity' })).toBe(started);
  });

  it('moves through every instruction, explains why, and returns to the original', () => {
    const state = atWhy();
    expect(state.activity?.phase).toBe('why');
    expect(act(state, { type: 'next-instruction' })).toBe(state);
    expect(act(state, { type: 'complete-activity' })).toEqual(atRefraction());
  });

  it('allows stepping back from the explanation to the final instruction and preparation', () => {
    let state = act(atWhy(), { type: 'previous-instruction' });
    expect(state.activity).toEqual({ phase: 'steps', instructionIndex: 3 });
    for (let i = 0; i < 4; i++) state = act(state, { type: 'previous-instruction' });
    expect(state.activity?.phase).toBe('intro');
    expect(act(state, { type: 'previous-instruction' })).toBe(state);
  });

  it.each(['intro', 'steps', 'why'] as const)('can leave during %s and reopening starts fresh', phase => {
    const state = phase === 'intro' ? atActivity() : phase === 'why' ? atWhy()
      : act(atActivity(), { type: 'start-activity' });
    const returned = act(state, { type: 'original' });
    expect(returned).toEqual(atRefraction());
    expect(act(returned, { type: 'select-variant', variantId: 'refraction-tryit' })).toEqual(atActivity());
  });

  it('switching away from an activity clears its instruction state', () => {
    const state = act(atWhy(), { type: 'select-variant', variantId: 'refraction-analogy' });
    expect(state.activity).toBeNull();
    expect(act(state, { type: 'select-variant', variantId: 'refraction-tryit' })).toEqual(atActivity());
  });

  it('uses returnToStep rather than whichever timeline moment opened the activity', () => {
    const value = structuredClone(fixture);
    value.timeline.push({ ...value.timeline[1], id: 'step-refraction-repeat' });
    const loaded = loadDemoLesson(value);
    if (!loaded.valid) throw new Error('Expected simulated repeated teacher moment');
    let state = initialPlayerState(loaded.model);
    for (let i = 0; i < 2; i++) state = reducePlayerState(loaded.model, state, { type: 'navigate', direction: 1 });
    state = reducePlayerState(loaded.model, state, { type: 'select-variant', variantId: 'refraction-tryit' });
    state = reducePlayerState(loaded.model, state, { type: 'original' });
    expect(loaded.model.steps[state.timelineIndex].step.id).toBe('step-refraction');
    expect(state.variantId).toBe('refraction-original');
  });
});
