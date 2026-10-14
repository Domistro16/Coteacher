import type { LessonPackage, QuizItem, TryItVariant } from './generated/lesson-package';
import type { PlayerState } from './generated/player-state';

export const voiceMessages = {
  exhausted: 'You’ve seen all the prepared explanations for this step.',
  activityOffer: 'Try the activity, or type a specific question about this moment.',
  questionOffer: 'Type a specific question about this moment.',
  related: 'This is a related explanation, rather than an answer to your question.',
  noActivity: 'There is no prepared activity at this step. You can ask a question or try another explanation.',
  inputUnavailable: 'Offline voice is unavailable on this device. Please type your question.',
  inputUnclear: 'I could not hear clearly. Please type your question.',
  inputFailed: 'Voice was unavailable. Please type your question.',
  checkTranscript: 'Check the transcript before sending.',
} as const;

/** Prepared conversation prompts, not instructional answers or a live AI service. */
export const companionMessages = {
  understanding: 'Does that make more sense? You can ask me another question, or we can try a quick check.',
  checkOffer: 'You said it makes more sense. Let us try one quick question before we return to your teacher.',
  pending: 'I do not have a reliable prepared answer to that question. It will stay pending until reviewed guidance comes back. You can keep learning while you wait.',
} as const;

export function activityCaptions(variant: TryItVariant, activity: NonNullable<PlayerState['activity']>): string[] {
  if (activity.phase === 'intro') return [variant.content,
    `What you need. ${variant.items.join('. ')}.`, `Before you start. ${variant.safetyNotes.join(' ')}`];
  if (activity.phase === 'why') return [`Why it works. ${variant.explainsWhy}`];
  return [`Instruction ${activity.instructionIndex + 1} of ${variant.steps.length}. ${variant.steps[activity.instructionIndex]}`];
}
export function quizCaption(item: { prompt: string; options: readonly string[] }): string {
  return `${item.prompt} ${item.options.map((option, index) => `Option ${index + 1}. ${option}.`).join(' ')}`;
}
export function quizFeedback(item: { explanation: string }, correct: boolean): string {
  return `${correct ? 'You’ve got it. ' : 'Let’s look at why. '}${item.explanation}`;
}

/** Exact captions bind each clip to reviewed text; no generated teaching content. */
export function preparedNarrationTexts(lesson: LessonPackage): string[] {
  const texts = [lesson.objective.text, lesson.matcher.noMatchMessage, ...Object.values(voiceMessages), ...Object.values(companionMessages)];
  for (const concept of lesson.concepts) for (const variant of concept.variants) {
    texts.push(variant.content);
    if (variant.type === 'tryit') {
      texts.push(...activityCaptions(variant, { phase: 'intro', instructionIndex: 0 }));
      texts.push(...activityCaptions(variant, { phase: 'why', instructionIndex: 0 }));
      variant.steps.forEach((_, instructionIndex) => texts.push(...activityCaptions(variant, { phase: 'steps', instructionIndex })));
      texts.push(variant.safetyNotes.join(' '));
    }
  }
  texts.push(...lesson.timeline.map(step => step.teacherSaid), ...lesson.questionBank.map(question => question.answer));
  for (const quiz of lesson.quiz) texts.push(quizCaption(quiz), quizFeedback(quiz, true), quizFeedback(quiz, false));
  texts.push(...lesson.route.conceptRoutes.map(route => route.reason));
  return [...new Set(texts)];
}
