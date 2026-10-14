import type { LessonPackage, Question } from './generated/lesson-package';

export type MatchResult = { match: Question; score: number } | { noMatch: true; score: number };
const stop = new Set('a an the is does do why what how in on at to of for it this that me please explain can you i my'.split(' '));
function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !stop.has(t)).map(t => ({ broken: 'bent', shifted: 'displaced', bending: 'bent', rays: 'light', ray: 'light', travels: 'travel', looks: 'look', appears: 'look' }[t] ?? t)));
}
export function matchQuestion(text: string, stepId: string, lesson: LessonPackage): MatchResult {
  const query = tokens(text);
  let best: Question | undefined; let score = 0;
  for (const question of lesson.questionBank) {
    for (const phrase of [question.question, ...question.alternatePhrasings]) {
      const candidate = tokens(phrase);
      const overlap = [...query].filter(t => candidate.has(t)).length;
      // A context boost cannot manufacture relevance. Unexplained query terms reduce confidence.
      const coverage = query.size ? overlap / query.size : 0;
      const similarity = candidate.size && query.size ? (2 * overlap) / (candidate.size + query.size) : 0;
      const value = coverage < 1 ? 0 : Math.min(1, similarity + (question.timelineStepId === stepId && overlap >= 2 ? 0.04 : 0));
      if (value > score) { score = value; best = question; }
    }
  }
  return best && score > lesson.matcher.confidenceThreshold ? { match: best, score } : { noMatch: true, score };
}
