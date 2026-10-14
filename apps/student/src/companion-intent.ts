export type CompanionIntent = 'confirm' | 'another' | 'check' | 'resume' | 'question';
const normalize = (text: string) => text.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[.!]+$/, '');

/** Deliberately narrow commands; a question containing these words stays a question. */
export function companionIntent(text: string, checkOffered = false): CompanionIntent {
  const value = normalize(text).replace(/^co[- ]?teacher[,:]?\s+/, '');
  // Speech often includes acknowledgements before an explicit request. Keep
  // requests anchored so questions about quizzes never become quiz commands.
  const request = value.replace(/^(?:(?:yes|yeah|yep|sure|okay|ok|(?:v-)?very well)[,.!\s]+)+/, '');
  if (/^(?:(?:i(?:'d| would) (?:like|love)|i want)(?: to (?:try|do|take))?|let's (?:try|do|take)|can (?:we|i) (?:try|do|take)) (?:a |the )?(?:quick |short |concept )?(?:check|quiz)(?: on (?:this|that|it))?(?: please)?\??$/.test(request)) return 'check';
  if (checkOffered && /^(?:yes|yeah|yep|sure|okay|ok|please|i(?:'d| would) like to|let's (?:do|try) it)$/.test(request)) return 'check';
  if (/^(?:yes(?:,? i (?:do )?(?:understand(?: (?:this|it|that))?|get it)(?: now)?)?|i (?:understand(?: (?:this|it|that))?|get it)(?: now)?|(?:it|that) makes sense(?: now)?)$/.test(value)) return 'confirm';
  if (/^(?:no|not yet|i (?:don't|do not) understand(?: (?:this|that|it))?|explain (?:again|differently)|show another explanation)$/.test(value)) return 'another';
  if (/^(?:quiz me|quick check|test me|check my understanding|let's try (?:a |the )?(?:quiz|check))$/.test(value)) return 'check';
  if (/^(?:resume(?: (?:the )?lesson)?|continue (?:the )?lesson|return to (?:the )?(?:lesson|recording|teacher))$/.test(value)) return 'resume';
  return 'question';
}
export function isCompanionInterruption(text: string): boolean {
  return /^co[- ]?teacher[,:]?\s+(?:i (?:don't|do not|can't|cannot) understand(?: (?:this|that|it|this part))?|(?:please )?explain (?:this|that|it))$/.test(normalize(text));
}
export function spokenQuizOption(text: string, options: readonly string[]): number | undefined {
  const value = normalize(text);
  const choice = /^(?:option|answer) (one|two|three|four|1|2|3|4)$/.exec(value);
  const index = choice ? ({ one: 0, two: 1, three: 2, four: 3, '1': 0, '2': 1, '3': 2, '4': 3 } as Record<string, number>)[choice[1]]
    : options.findIndex(option => normalize(option) === value);
  return index >= 0 && index < options.length ? index : undefined;
}
