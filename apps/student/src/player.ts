import type { Concept, LessonPackage, ProgressEvent, TimelineStep, Variant } from '@coteacher/shared';
import type { PlayerState } from '@coteacher/shared';
export type { PlayerState } from '@coteacher/shared';

export const variantLabels: Record<Variant['type'], string> = {
  original: 'Original', short: 'Short', analogy: 'Analogy',
  stepwise: 'Step by step', refresher: 'Refresher', tryit: 'Try it',
};

export interface PlayerStep {
  step: TimelineStep;
  concept: Concept;
  original: Variant;
  variants: Variant[];
  reason: string;
}
export interface PlayerModel { lesson: LessonPackage; steps: PlayerStep[] }
export type PlayerAction =
  | { type: 'navigate'; direction: -1 | 1 }
  | { type: 'revisit-step'; timelineStepId: string }
  | { type: 'select-variant'; variantId: string }
  | { type: 'original' }
  | { type: 'start-activity' }
  | { type: 'next-instruction' }
  | { type: 'previous-instruction' }
  | { type: 'complete-activity' };

/** Build lookup data only after shared schema and integrity validation. */
export function createPlayerModel(lesson: LessonPackage): PlayerModel {
  const concepts = new Map(lesson.concepts.map(concept => [concept.id, concept]));
  const routes = new Map(lesson.route.conceptRoutes.map(route => [route.conceptId, route]));
  const steps = lesson.timeline.map(step => {
    const concept = concepts.get(step.conceptId);
    const route = routes.get(step.conceptId);
    const original = concept?.variants.find(variant => variant.type === 'original');
    if (!concept || !route || !original) throw new Error('The demo is missing a concept, route, or original explanation.');
    const byId = new Map(concept.variants.map(variant => [variant.id, variant]));
    const variants = route.variantOrder.map(id => {
      const variant = byId.get(id);
      if (!variant) throw new Error('The demo has an unavailable route variant.');
      return variant;
    });
    return { step, concept, original, variants, reason: route.reason };
  });
  return { lesson, steps };
}

function selectVariant(timelineIndex: number, variant: Variant): PlayerState {
  return { timelineIndex, variantId: variant.id,
    activity: variant.type === 'tryit' ? { phase: 'intro', instructionIndex: 0 } : null };
}
function enterStep(model: PlayerModel, index: number): PlayerState {
  const entry = model.steps[index];
  return selectVariant(index, entry.variants[0]);
}
export function initialPlayerState(model: PlayerModel): PlayerState { return enterStep(model, 0); }
export function selectedVariant(model: PlayerModel, state: PlayerState): Variant {
  return model.steps[state.timelineIndex].concept.variants.find(variant => variant.id === state.variantId)!;
}
function returnOriginal(model: PlayerModel, state: PlayerState): PlayerState {
  const variant = selectedVariant(model, state);
  const index = variant.type === 'tryit'
    ? model.steps.findIndex(entry => entry.step.id === variant.returnToStep) : state.timelineIndex;
  return selectVariant(index, model.steps[index].original);
}
export function reducePlayerState(model: PlayerModel, state: PlayerState, action: PlayerAction): PlayerState {
  const next = reduceStudyState(model, state, action);
  return state.recording && next !== state ? { ...next, recording: state.recording } : next;
}
function reduceStudyState(model: PlayerModel, state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'navigate': {
      const index = state.timelineIndex + action.direction;
      return index < 0 || index >= model.steps.length ? state : enterStep(model, index);
    }
    case 'revisit-step': {
      const index = model.steps.findIndex(entry => entry.step.id === action.timelineStepId);
      if (index < 0) return state;
      const entry = model.steps[index];
      const variant = entry.concept.variants.find(item => item.id === entry.step.defaultVariantId)!;
      return selectVariant(index, variant);
    }
    case 'select-variant': {
      const variant = model.steps[state.timelineIndex].variants.find(item => item.id === action.variantId);
      return variant ? selectVariant(state.timelineIndex, variant) : state;
    }
    case 'original': return returnOriginal(model, state);
    case 'start-activity':
      return state.activity?.phase === 'intro'
        ? { ...state, activity: { phase: 'steps', instructionIndex: 0 } } : state;
    case 'next-instruction': {
      const variant = selectedVariant(model, state);
      if (variant.type !== 'tryit' || state.activity?.phase !== 'steps') return state;
      const index = state.activity.instructionIndex;
      return { ...state, activity: index + 1 < variant.steps.length
        ? { phase: 'steps', instructionIndex: index + 1 } : { phase: 'why', instructionIndex: index } };
    }
    case 'previous-instruction': {
      if (!state.activity || state.activity.phase === 'intro') return state;
      const index = state.activity.instructionIndex;
      return { ...state, activity: state.activity.phase === 'why'
        ? { phase: 'steps', instructionIndex: index }
        : index === 0 ? { phase: 'intro', instructionIndex: 0 }
        : { phase: 'steps', instructionIndex: index - 1 } };
    }
    case 'complete-activity':
      return state.activity?.phase === 'why' ? returnOriginal(model, state) : state;
  }
}

/** Record every displayed destination, including the activity's return moment. */
export function transitionPlayer(model: PlayerModel, state: PlayerState, action: PlayerAction, timestamp: string): { player: PlayerState; events: ProgressEvent[] } {
  const player = reducePlayerState(model, state, action);
  const events: ProgressEvent[] = [];
  if (player === state) return { player, events };
  const current = model.steps[state.timelineIndex];
  const context = { timestamp, conceptId: current.concept.id, timelineStepId: current.step.id };
  if (action.type === 'original') events.push({ ...context, type: 'replay' });
  const variant = selectedVariant(model, state);
  if (action.type === 'complete-activity' && variant.type === 'tryit') events.push({ ...context, type: 'tryit-completed', variantId: variant.id });
  if (['select-variant', 'original', 'navigate', 'revisit-step', 'complete-activity'].includes(action.type)) {
    const destination = model.steps[player.timelineIndex];
    events.push({ type: 'variant-viewed', timestamp, conceptId: destination.concept.id,
      timelineStepId: destination.step.id, variantId: player.variantId });
  }
  return { player, events };
}
