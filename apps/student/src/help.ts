import { matchQuestion, voiceMessages, type ProgressEvent, type ProgressRecord, type Variant } from '@coteacher/shared';
import { reducePlayerState, transitionPlayer, type PlayerModel, type PlayerState } from './player';

export type CommandIntent = 'pause' | 'replay' | 'explain-differently' | 'try-it' | 'quiz' | 'repeat';
export type StudentIntent = { type: 'command'; command: CommandIntent; context?: string } | { type: 'help'; context: string };

function clean(text: string): string {
  return text.trim().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();
}

/** Small command grammar; all other words remain current-step matcher context. */
export function detectStudentIntent(text: string): StudentIntent {
  const normalized = clean(text);
  const contextual = /^(?:pause here[.,!;:]?\s*)?(?:i understand (?:this|that)(?: part)?\s*,?\s*)?but i (?:don't|do not) understand(?:\s+(.+))?$/i.exec(normalized);
  // Preserve the brief's explicit pause request and optional confusion suffix.
  if (contextual) return { type: 'command', command: 'explain-differently', ...(contextual[1] ? { context: contextual[1].trim() } : {}) };
  const pausedHelp = /^pause here[.,!;:]?\s+i (?:don't|do not) (?:get|understand) (.+)$/i.exec(normalized);
  if (pausedHelp) return { type: 'command', command: 'explain-differently', context: pausedHelp[1] };
  let command = normalized.toLowerCase().replace(/^(?:can|could|would) you\s+/, '').replace(/^please\s+/, '').replace(/,? please$/, '');
  const rules: [CommandIntent, RegExp][] = [
    ['pause', /^(?:pause|stop|hold)(?: (?:the )?(?:audio|speech|narration|playback))?(?: for (?:a )?(?:moment|second))?$|^stop (?:talking|speaking)$/],
    ['replay', /^(?:replay(?: (?:the )?(?:audio|explanation|lesson))?|play (?:it|that|this) (?:back|again))$/],
    ['explain-differently', /^(?:pause here|explain(?: (?:this|that|it))? (?:again|differently|another way|in another way)|(?:say|put) (?:this|that|it) (?:differently|another way|in another way|more simply)|break (?:this|that|it) down|(?:show|give) me (?:a different|another) (?:explanation|example)|use (?:a different|another) example)$/],
    ['try-it', /^(?:try it|let(?:'s| us) try (?:it|the activity)|(?:start|show|do) (?:the |an |this )?(?:activity|experiment|demonstration)|i want to try (?:it|the activity))$/],
    ['quiz', /^(?:quiz(?: me)?|(?:test|check) (?:me|my understanding|my knowledge)|(?:start|open|give me) (?:the |a )?quiz)$/],
    ['repeat', /^repeat(?: (?:that|it|this|the last explanation))?$/],
  ];
  const direct = rules.find(([, pattern]) => pattern.test(command));
  if (direct) return { type: 'command', command: direct[0] };
  // Correct one substitution/transposition in long command words only. Never
  // delete a token or fuzz short words ("reply", "quiet", questions stay help).
  const vocabulary = ['explain', 'differently', 'another', 'repeat', 'replay', 'activity', 'understanding', 'experiment'];
  const tokens = command.split(' ');
  let corrections = 0;
  command = tokens.map(token => {
    if (vocabulary.includes(token)) return token;
    const candidates = vocabulary.filter(word => word.length === token.length && word.length >= 6 && (() => {
      const differences = [...word].map((char, index) => char === token[index] ? -1 : index).filter(index => index >= 0);
      return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && word[differences[0]] === token[differences[1]] && word[differences[1]] === token[differences[0]]);
    })());
    if (candidates.length === 1) { corrections++; return candidates[0]; }
    return token;
  }).join(' ');
  const fuzzy = corrections === 1 && rules.find(([, pattern]) => pattern.test(command));
  if (fuzzy) return { type: 'command', command: fuzzy[0] };
  return { type: 'help', context: text.trim() };
}

export function nextUnseenExplanation(model: PlayerModel, player: PlayerState, progress: ProgressRecord): Variant | undefined {
  const current = model.steps[player.timelineIndex];
  const seen = new Set([player.variantId]);
  if (progress.studentId === model.lesson.studentId && progress.lessonId === model.lesson.lessonId) {
    for (const event of progress.events) {
      if (event.type === 'variant-viewed' && event.timelineStepId === current.step.id) seen.add(event.variantId);
    }
  }
  return current.variants.find(variant => variant.type !== 'tryit' && !seen.has(variant.id));
}

export interface StudentResponse {
  help?: { variant: Variant } | { exhausted: true };
  question?: { text: string; refs: string[]; step?: string; related?: Variant };
  command?: CommandIntent;
  notice?: string;
}

/** One update for explanation, supplemental answer and queue: no event is lost. */
export function handleStudentRequest(model: PlayerModel, player: PlayerState, progress: ProgressRecord, text: string,
  timestamp: string, createQuestionId: () => string): { player: PlayerState; progress: ProgressRecord; response: StudentResponse } {
  if (progress.studentId !== model.lesson.studentId || progress.lessonId !== model.lesson.lessonId) {
    throw new Error('Progress belongs to a different learner or lesson.');
  }
  const current = model.steps[player.timelineIndex];
  const context = { timestamp, conceptId: current.concept.id, timelineStepId: current.step.id };
  const intent = detectStudentIntent(text);
  const events: ProgressEvent[] = [];
  const queuedQuestions = [...progress.queuedQuestions];
  const response: StudentResponse = {};
  let nextPlayer = player;
  if (intent.type === 'command' && intent.command !== 'explain-differently') {
    response.command = intent.command;
    if (intent.command === 'try-it') {
      const activity = current.variants.find(variant => variant.type === 'tryit');
      if (activity) {
        const transition = transitionPlayer(model, player, { type: 'select-variant', variantId: activity.id }, timestamp);
        nextPlayer = transition.player; events.push(...transition.events);
      } else response.notice = voiceMessages.noActivity;
    }
  }
  if (intent.type === 'command' && intent.command === 'explain-differently') {
    // Preserve the visible explanation even when reopening an older sparse record.
    if (!progress.events.some(e => e.type === 'variant-viewed' && e.timelineStepId === current.step.id && e.variantId === player.variantId)) {
      events.push({ ...context, type: 'variant-viewed', variantId: player.variantId });
    }
    events.push({ ...context, type: 'pause' }, { ...context, type: 'explain-again' });
    const variant = nextUnseenExplanation(model, player, progress);
    if (variant) {
      nextPlayer = reducePlayerState(model, player, { type: 'select-variant', variantId: variant.id });
      events.push({ ...context, type: 'variant-viewed', variantId: variant.id });
      response.help = { variant };
    } else response.help = { exhausted: true };
  }
  const questionText = intent.context;
  if (questionText) {
    // Even generic suffixes reach the matcher; they are not meaningful queued questions.
    const result = matchQuestion(questionText, current.step.id, model.lesson);
    const generic = intent.type === 'command' && /^(?:this|that|it)(?: part)?$/i.test(clean(questionText));
    if ('match' in result) {
      events.push({ type: 'question-matched', timestamp, conceptId: result.match.conceptId,
        timelineStepId: result.match.timelineStepId, questionId: result.match.id, matcherScore: result.score });
      response.question = { text: result.match.answer, refs: result.match.sourceRefs, step: result.match.timelineStepId };
    } else if (!generic) {
      const id = createQuestionId();
      events.push({ ...context, type: 'question-no-match', questionId: id, matcherScore: result.score });
      queuedQuestions.push({ id, text: questionText, askedAt: timestamp, timelineStepId: current.step.id, answered: false });
      const related = response.help && 'variant' in response.help ? response.help.variant : nextUnseenExplanation(model, player, progress);
      response.question = { text: model.lesson.matcher.noMatchMessage, refs: [], ...(related ? { related } : {}) };
      if (related && ![...progress.events, ...events].some(e => e.type === 'variant-viewed' && e.timelineStepId === current.step.id && e.variantId === related.id)) {
        events.push({ ...context, type: 'variant-viewed', variantId: related.id });
      }
    }
    const completed = [...progress.events].reverse().find(e => e.type === 'tryit-completed' && e.timelineStepId === current.step.id);
    if (response.question && completed?.type === 'tryit-completed') {
      const noMatch = events.find(e => e.type === 'question-no-match');
      events.push({ ...context, type: 'tryit-follow-up', variantId: completed.variantId, text: questionText,
        ...(noMatch?.type === 'question-no-match' ? { questionId: noMatch.questionId } : {}) });
    }
  }
  return { player: nextPlayer, progress: { ...progress, events: [...progress.events, ...events], queuedQuestions }, response };
}
