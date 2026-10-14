import { expect, it } from 'vitest';
import { demoLessons, emptyProgress, matchQuestion } from '@coteacher/shared';
import { detectStudentIntent, handleStudentRequest, type CommandIntent } from '../apps/student/src/help';
import { createPlayerModel, initialPlayerState } from '../apps/student/src/player';

const commands: [string, CommandIntent][] = [
  ['pause', 'pause'], ['pause audio', 'pause'], ['stop talking', 'pause'], ['could you hold for a moment?', 'pause'],
  ['replay the explanation', 'replay'], ['play that back', 'replay'], ['replaY', 'replay'],
  ['please repeat that', 'repeat'], ['repeet it', 'repeat'],
  ['can you put it more simply?', 'explain-differently'], ['use another example', 'explain-differently'],
  ['show me another explanation', 'explain-differently'], ['explain it in another way', 'explain-differently'],
  ['let’s try it', 'try-it'], ['start the experiment', 'try-it'], ['do this activity', 'try-it'],
  ['quiz me', 'quiz'], ['test my understanding', 'quiz'], ['give me a quiz please', 'quiz'],
];
it.each(commands)('recognizes varied command %s', (text, command) => {
  expect(detectStudentIntent(text)).toEqual({ type: 'command', command });
});
it.each(['The bit with the water still makes no sense', 'Could light move in a circle?', 'repeat why it happens',
  'Should I stop drinking water?', 'Why do we repeat the experiment?', 'How does a quiz work?',
  'start a fire', 'I want to try glass instead', 'Can you explain what differently means?'])('passes unscripted words/near-miss %s intact as help context', text => {
  const lesson = demoLessons()[0]; const model = createPlayerModel(lesson); const player = initialPlayerState(model);
  expect(detectStudentIntent(text)).toEqual({ type: 'help', context: text });
  const result = handleStudentRequest(model, player, emptyProgress(lesson), text, '2026-10-09T00:00:00Z', () => 'queued-intent');
  expect(result.response.command).toBeUndefined(); expect(result.player).toBe(player);
  expect(result.response.question?.text).toBe(lesson.matcher.noMatchMessage);
  expect(result.progress.queuedQuestions[0].text).toBe(text);
  expect(result.progress.events.some(e => e.type === 'explain-again')).toBe(false);
  expect(result.progress.events.find(e => e.type === 'question-no-match')).toHaveProperty('matcherScore', matchQuestion(text, 'step-light', lesson).score);
});
it('reports an unavailable activity honestly instead of starting another step', () => {
  const lesson = demoLessons()[0]; const model = createPlayerModel(lesson); const player = initialPlayerState(model);
  const next = handleStudentRequest(model, player, emptyProgress(lesson), 'try it', '2026-10-09T00:00:00Z', () => 'q');
  expect(next.player).toBe(player); expect(next.response.notice).toContain('no prepared activity');
  expect(next.progress.queuedQuestions).toEqual([]);
});
