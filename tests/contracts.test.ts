import { readFileSync, readdirSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { describe, expect, it } from 'vitest';
import {
  validateLessonPackage,
  validateProgressRecord,
  type LessonPackage,
  type ProgressRecord,
  type ValidationResult,
} from '@coteacher/shared';

// Deliberately mutable/untyped: negative cases must be able to violate the contract.
type Fixture = Record<string, any>;
const fixtureRoot = new URL('../fixtures/', import.meta.url);
function readFixture(path: string): Fixture {
  return JSON.parse(readFileSync(new URL(path, fixtureRoot), 'utf8'));
}
function lesson(): Fixture { return readFixture('demo-lesson/lesson-package.json'); }
function progress(): Fixture { return readFixture('demo-lesson/progress-record.json'); }
const validLessonResult = validateLessonPackage(lesson());
if (!validLessonResult.valid) throw new Error(JSON.stringify(validLessonResult.issues));
const validLesson = validLessonResult.data;

function expectIssue(result: ValidationResult<unknown>, stage: 'schema' | 'integrity', code: string, path: string): void {
  expect(result.valid).toBe(false);
  if (result.valid) throw new Error('Expected validation failure');
  expect(result.issues).toContainEqual(expect.objectContaining({ stage, code, path }));
  if (stage === 'integrity') expect(result.issues.every(error => error.stage === 'integrity')).toBe(true);
}

describe('the hand-written simulated demo', () => {
  it('passes lesson and progress validation, including cross-file integrity', () => {
    const packageValue = lesson();
    const recordValue = progress();
    expect(validateLessonPackage(packageValue)).toEqual({ valid: true, data: packageValue });
    expect(validateProgressRecord(recordValue)).toEqual({ valid: true, data: recordValue });
    expect(validateProgressRecord(recordValue, validLesson)).toEqual({ valid: true, data: recordValue });
  });

  it('has all six variant types, exactly one Try it, and all nine event types', () => {
    const variants = validLesson.concepts.flatMap(concept => concept.variants);
    expect(new Set(variants.map(variant => variant.type))).toEqual(new Set(['original', 'short', 'analogy', 'stepwise', 'refresher', 'tryit']));
    const activities = variants.filter(variant => variant.type === 'tryit');
    expect(activities).toHaveLength(1);
    expect(activities[0].returnToStep).toBe('step-refraction');
    expect(activities[0].items).toContain('One unsharpened pencil with no sharp point');
    expect(activities[0].items).toContain('One clear plastic cup');
    expect(new Set(progress().events.map((event: Fixture) => event.type))).toEqual(new Set([
      'pause', 'replay', 'explain-again', 'variant-viewed', 'tryit-completed',
      'question-matched', 'question-no-match', 'quiz-answered', 'tryit-follow-up',
    ]));
  });

  it('supports different student routes to an unchanged objective', () => {
    const second = lesson();
    second.studentId = 'student-b1c2d3e4';
    second.route.conceptRoutes[1].variantOrder = ['refraction-original', 'refraction-stepwise', 'refraction-tryit'];
    second.route.conceptRoutes[1].reason = 'Review each step before the observation. You can switch to the original.';
    expect(validateLessonPackage(second).valid).toBe(true);
    expect(second.objective).toEqual(validLesson.objective);
    expect(second.route).not.toEqual(validLesson.route);
  });

  it('requires every committed JSON fixture to be explicitly simulated', () => {
    for (const folder of ['demo-lesson', 'invalid']) {
      for (const file of readdirSync(new URL(folder + '/', fixtureRoot))) {
        if (file.endsWith('.json')) expect(readFixture(folder + '/' + file).simulated, file).toBe(true);
      }
    }
  });

  it('keeps the contract flag boolean and accepts empty progress histories', () => {
    const packageValue = lesson();
    packageValue.simulated = false;
    const recordValue = progress();
    recordValue.simulated = false;
    recordValue.events = [];
    recordValue.queuedQuestions = [];
    expect(validateLessonPackage(packageValue).valid).toBe(true);
    expect(validateProgressRecord(recordValue, validLesson).valid).toBe(true);
  });

  it('preserves input objects and returns typed data without copying', () => {
    const packageValue = lesson();
    const recordValue = progress();
    const before = JSON.stringify([packageValue, recordValue]);
    const packageResult = validateLessonPackage(packageValue);
    const recordResult = validateProgressRecord(recordValue, validLesson);
    expect(JSON.stringify([packageValue, recordValue])).toBe(before);
    if (!packageResult.valid || !recordResult.valid) throw new Error('Expected valid data');
    const typedLesson: LessonPackage = packageResult.data;
    const typedProgress: ProgressRecord = recordResult.data;
    expect(typedLesson).toBe(packageValue);
    expect(typedProgress).toBe(recordValue);
  });
});

describe('six separate required invalid fixtures', () => {
  const cases = [
    ['missing-source-refs', 'schema', 'schema.required', '/concepts/0/variants/0/sourceRefs'],
    ['nonexistent-source', 'integrity', 'reference.source', '/questionBank/0/sourceRefs/0'],
    ['tryit-without-safety-notes', 'schema', 'schema.required', '/concepts/1/variants/4/safetyNotes'],
    ['correct-index-out-of-range', 'integrity', 'quiz.correct-index', '/quiz/0/correctIndex'],
    ['real-looking-student-name', 'schema', 'schema.pattern', '/studentId'],
    ['unknown-progress-event', 'schema', 'schema.enum', '/events/0/type'],
  ] as const;
  it.each(cases)('%s fails for its intended reason', (name, stage, code, path) => {
    const value = readFixture('invalid/' + name + '.json');
    const result = name === 'unknown-progress-event'
      ? validateProgressRecord(value, validLesson) : validateLessonPackage(value);
    expectIssue(result, stage, code, path);
  });
});

describe('schema boundaries', () => {
  it.each([null, [], 'lesson', 123, {}])('rejects malformed input %j without throwing', value => {
    expect(validateLessonPackage(value).valid).toBe(false);
    expect(validateProgressRecord(value).valid).toBe(false);
  });

  it.each(['lesson-package', 'progress-record'])('%s uses draft 2020-12 and closes every object definition', name => {
    const schema = JSON.parse(readFileSync(new URL('../schemas/' + name + '.schema.json', import.meta.url), 'utf8'));
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.required).toContain('schemaVersion');
    function visit(value: any): void {
      if (value === null || typeof value !== 'object') return;
      if (value.type === 'object') expect(value.additionalProperties).toBe(false);
      Object.values(value).forEach(visit);
    }
    visit(schema);
  });

  const closedPaths: [string, (value: Fixture) => Fixture][] = [
    ['', value => value], ['/objective', value => value.objective],
    ['/sources/0', value => value.sources[0]], ['/concepts/0', value => value.concepts[0]],
    ['/concepts/0/variants/0', value => value.concepts[0].variants[0]],
    ['/concepts/1/variants/4', value => value.concepts[1].variants[4]],
    ['/timeline/0', value => value.timeline[0]], ['/questionBank/0', value => value.questionBank[0]],
    ['/quiz/0', value => value.quiz[0]], ['/route', value => value.route],
    ['/route/conceptRoutes/0', value => value.route.conceptRoutes[0]],
    ['/route/insertedRefreshers/0', value => value.route.insertedRefreshers[0]],
    ['/matcher', value => value.matcher],
  ];
  it.each(closedPaths)('rejects unexpected properties at %s', (path, target) => {
    const value = lesson();
    target(value).unexpected = true;
    expectIssue(validateLessonPackage(value), 'schema', 'schema.additionalProperties', path + '/unexpected');
  });

  const contentPaths: [string, (value: Fixture) => Fixture][] = [
    ['/concepts/0', value => value.concepts[0]],
    ['/concepts/0/variants/0', value => value.concepts[0].variants[0]],
    ['/concepts/1/variants/4', value => value.concepts[1].variants[4]],
    ['/timeline/0', value => value.timeline[0]],
    ['/questionBank/0', value => value.questionBank[0]],
    ['/quiz/0', value => value.quiz[0]],
  ];
  it.each(contentPaths)('rejects empty sourceRefs at %s', (path, target) => {
    const value = lesson();
    target(value).sourceRefs = [];
    expectIssue(validateLessonPackage(value), 'schema', 'schema.minItems', path + '/sourceRefs');
  });
  it.each(contentPaths)('checks sourceRefs at %s', (path, target) => {
    const value = lesson();
    target(value).sourceRefs = ['missing'];
    expectIssue(validateLessonPackage(value), 'integrity', 'reference.source', path + '/sourceRefs/0');
  });

  it.each(['https://example.invalid/audio.ogg', '/audio.ogg', 'C:/audio.ogg', 'C:\\audio.ogg', '../audio.ogg', 'assets/../audio.ogg', 'assets/./audio.ogg', 'assets\\audio.ogg'])('rejects unsafe asset path %s', path => {
    const value = lesson();
    value.concepts[0].variants[0].audioAssetPath = path;
    expectIssue(validateLessonPackage(value), 'schema', 'schema.pattern', '/concepts/0/variants/0/audioAssetPath');
  });
  it('accepts local visual and audio paths without opening them', () => {
    const value = lesson();
    value.concepts[0].variants[0].visualAssetPath = 'visuals/light.svg';
    value.concepts[0].variants[0].audioAssetPath = 'audio/light.ogg';
    expect(validateLessonPackage(value).valid).toBe(true);
  });

  it.each(['schemaVersion', 'simulated', 'studentId'])('requires %s on both records', property => {
    const packageValue = lesson();
    const recordValue = progress();
    delete packageValue[property];
    delete recordValue[property];
    expectIssue(validateLessonPackage(packageValue), 'schema', 'schema.required', '/' + property);
    expectIssue(validateProgressRecord(recordValue), 'schema', 'schema.required', '/' + property);
  });
  it.each(['1.1.0', 1])('rejects unsupported schema version %s', version => {
    const packageValue = lesson();
    const recordValue = progress();
    packageValue.schemaVersion = version;
    recordValue.schemaVersion = version;
    expectIssue(validateLessonPackage(packageValue), 'schema', 'schema.const', '/schemaVersion');
    expectIssue(validateProgressRecord(recordValue), 'schema', 'schema.const', '/schemaVersion');
  });
  it.each(['student-001', 'Alex Example', 'student-ABCDEF12', 'student-1234567'])('rejects nonopaque student ID %s', id => {
    const value = progress();
    value.studentId = id;
    expectIssue(validateProgressRecord(value), 'schema', 'schema.pattern', '/studentId');
  });
  it('rejects blank content, a single quiz option, and noninteger quiz indices', () => {
    const value = lesson();
    value.concepts[0].variants[0].content = '   ';
    value.quiz[0].options = ['one'];
    value.quiz[0].correctIndex = 0.5;
    const result = validateLessonPackage(value);
    expectIssue(result, 'schema', 'schema.pattern', '/concepts/0/variants/0/content');
    expectIssue(result, 'schema', 'schema.minItems', '/quiz/0/options');
    expectIssue(result, 'schema', 'schema.type', '/quiz/0/correctIndex');
  });
});

describe('lesson relationships', () => {
  const cases: [string, (value: Fixture) => void, string, string][] = [
    ['objective concept', v => { v.objective.conceptIds[0] = 'missing'; }, 'reference.concept', '/objective/conceptIds/0'],
    ['prerequisite', v => { v.concepts[1].prerequisiteConceptIds[0] = 'missing'; }, 'reference.concept', '/concepts/1/prerequisiteConceptIds/0'],
    ['timeline concept', v => { v.timeline[0].conceptId = 'missing'; }, 'reference.concept', '/timeline/0/conceptId'],
    ['default variant', v => { v.timeline[0].defaultVariantId = 'missing'; }, 'reference.variant', '/timeline/0/defaultVariantId'],
    ['default variant ownership', v => { v.timeline[0].defaultVariantId = 'refraction-short'; }, 'context.variant-concept', '/timeline/0/defaultVariantId'],
    ['question concept', v => { v.questionBank[0].conceptId = 'missing'; }, 'reference.concept', '/questionBank/0/conceptId'],
    ['question step', v => { v.questionBank[0].timelineStepId = 'missing'; }, 'reference.timeline-step', '/questionBank/0/timelineStepId'],
    ['question step ownership', v => { v.questionBank[0].timelineStepId = 'step-light'; }, 'context.step-concept', '/questionBank/0/timelineStepId'],
    ['quiz concept', v => { v.quiz[0].conceptId = 'missing'; }, 'reference.concept', '/quiz/0/conceptId'],
    ['Try it return', v => { v.concepts[1].variants[4].returnToStep = 'missing'; }, 'reference.timeline-step', '/concepts/1/variants/4/returnToStep'],
    ['Try it return ownership', v => { v.concepts[1].variants[4].returnToStep = 'step-light'; }, 'context.step-concept', '/concepts/1/variants/4/returnToStep'],
    ['route concept', v => { v.route.conceptOrder[0] = 'missing'; }, 'reference.concept', '/route/conceptOrder/0'],
    ['route variant', v => { v.route.conceptRoutes[0].variantOrder[0] = 'missing'; }, 'reference.variant', '/route/conceptRoutes/0/variantOrder/0'],
    ['route variant ownership', v => { v.route.conceptRoutes[0].variantOrder[0] = 'refraction-short'; }, 'context.variant-concept', '/route/conceptRoutes/0/variantOrder/0'],
    ['objective coverage', v => { v.route.conceptOrder.pop(); v.route.conceptRoutes.pop(); v.route.insertedRefreshers = []; }, 'route.objective-coverage', '/route/conceptOrder'],
    ['missing concept route', v => { v.route.conceptRoutes.pop(); }, 'route.missing-concept', '/route/conceptRoutes'],
    ['duplicate concept route', v => { v.route.conceptRoutes.push(v.route.conceptRoutes[0]); }, 'route.duplicate-concept', '/route/conceptRoutes/2/conceptId'],
    ['unordered route entry', v => { v.route.conceptOrder.pop(); }, 'route.unordered-concept', '/route/conceptRoutes/1/conceptId'],
    ['refresher concept', v => { v.route.insertedRefreshers[0].conceptId = 'missing'; }, 'reference.concept', '/route/insertedRefreshers/0/conceptId'],
    ['refresher variant', v => { v.route.insertedRefreshers[0].variantId = 'missing'; }, 'reference.variant', '/route/insertedRefreshers/0/variantId'],
    ['refresher target', v => { v.route.insertedRefreshers[0].beforeConceptId = 'missing'; }, 'reference.concept', '/route/insertedRefreshers/0/beforeConceptId'],
    ['refresher type', v => { v.route.insertedRefreshers[0].variantId = 'light-original'; }, 'route.refresher-type', '/route/insertedRefreshers/0/variantId'],
  ];
  it.each(cases)('rejects broken %s', (_name, mutate, code, path) => {
    const value = lesson();
    mutate(value);
    expectIssue(validateLessonPackage(value), 'integrity', code, path);
  });
  it.each(['sources', 'concepts', 'timeline', 'questionBank', 'quiz'])('rejects duplicate %s IDs', key => {
    const value = lesson();
    value[key][1].id = value[key][0].id;
    expectIssue(validateLessonPackage(value), 'integrity', 'duplicate.id', `/${key}/1/id`);
  });
  it('rejects variant IDs duplicated across concepts', () => {
    const value = lesson();
    value.concepts[1].variants[0].id = 'light-original';
    expectIssue(validateLessonPackage(value), 'integrity', 'duplicate.id', '/concepts/1/variants/0/id');
  });
  it('accepts first and last correctIndex and rejects negative indices', () => {
    const value = lesson();
    for (const index of [0, value.quiz[0].options.length - 1]) {
      value.quiz[0].correctIndex = index;
      expect(validateLessonPackage(value).valid).toBe(true);
    }
    value.quiz[0].correctIndex = -1;
    expectIssue(validateLessonPackage(value), 'schema', 'schema.minimum', '/quiz/0/correctIndex');
  });
});

describe('progress validation', () => {
  const cases: [string, (value: Fixture) => void, string, string][] = [
    ['lesson identity', v => { v.lessonId = 'another-lesson'; }, 'identity.lesson', '/lessonId'],
    ['student identity', v => { v.studentId = 'student-12345678'; }, 'identity.student', '/studentId'],
    ['concept reference', v => { v.events[0].conceptId = 'missing'; }, 'reference.concept', '/events/0/conceptId'],
    ['step reference', v => { v.events[0].timelineStepId = 'missing'; }, 'reference.timeline-step', '/events/0/timelineStepId'],
    ['step context', v => { v.events[0].timelineStepId = 'step-light'; }, 'context.step-concept', '/events/0/timelineStepId'],
    ['variant reference', v => { v.events[3].variantId = 'missing'; }, 'reference.variant', '/events/3/variantId'],
    ['variant context', v => { v.events[3].variantId = 'light-original'; }, 'context.variant-concept', '/events/3/variantId'],
    ['Try it event type', v => { v.events[4].variantId = 'refraction-short'; }, 'context.tryit-variant', '/events/4/variantId'],
    ['follow-up activity', v => { v.events[8].variantId = 'refraction-short'; }, 'context.tryit-variant', '/events/8/variantId'],
    ['matched question', v => { v.events[5].questionId = 'missing'; }, 'reference.question', '/events/5/questionId'],
    ['matched question context', v => { v.events[5].questionId = 'question-straight'; }, 'context.question', '/events/5/questionId'],
    ['no-match queue reference', v => { v.events[6].questionId = 'missing'; }, 'reference.queued-question', '/events/6/questionId'],
    ['follow-up queue reference', v => { v.events[8].questionId = 'missing'; }, 'reference.queued-question', '/events/8/questionId'],
    ['queued step reference', v => { v.queuedQuestions[0].timelineStepId = 'missing'; }, 'reference.timeline-step', '/queuedQuestions/0/timelineStepId'],
    ['queued step context', v => { v.queuedQuestions[0].timelineStepId = 'step-light'; }, 'context.queued-question-step', '/events/6/questionId'],
    ['queued source', v => { v.queuedQuestions[1].sourceRefs = ['missing']; }, 'reference.source', '/queuedQuestions/1/sourceRefs/0'],
    ['quiz reference', v => { v.events[7].quizId = 'missing'; }, 'reference.quiz', '/events/7/quizId'],
    ['quiz context', v => { v.events[7].quizId = 'quiz-light'; }, 'context.quiz-concept', '/events/7/quizId'],
    ['duplicate queued IDs', v => { v.queuedQuestions[1].id = v.queuedQuestions[0].id; }, 'duplicate.id', '/queuedQuestions/1/id'],
  ];
  it.each(cases)('rejects broken %s', (_name, mutate, code, path) => {
    const value = progress();
    mutate(value);
    expectIssue(validateProgressRecord(value, validLesson), 'integrity', code, path);
  });

  it('checks internal queued references even without a lesson', () => {
    const value = progress();
    value.events[6].questionId = 'missing';
    expectIssue(validateProgressRecord(value), 'integrity', 'reference.queued-question', '/events/6/questionId');
  });
  it('makes the limit of context-free validation explicit', () => {
    const value = progress();
    value.events[5].questionId = 'missing';
    expect(validateProgressRecord(value).valid).toBe(true);
    expectIssue(validateProgressRecord(value, validLesson), 'integrity', 'reference.question', '/events/5/questionId');
  });
  it('allows a follow-up without a queued question', () => {
    const value = progress();
    delete value.events[8].questionId;
    expect(validateProgressRecord(value, validLesson).valid).toBe(true);
  });

  it.each([0.71, 0.72])('rejects matched score %s at or below the threshold', score => {
    const value = progress();
    value.events[5].matcherScore = score;
    expectIssue(validateProgressRecord(value, validLesson), 'integrity', 'matcher.below-threshold', '/events/5/matcherScore');
  });
  it('accepts a match above the threshold and a no-match at the threshold', () => {
    const value = progress();
    value.events[5].matcherScore = 0.73;
    value.events[6].matcherScore = 0.72;
    expect(validateProgressRecord(value, validLesson).valid).toBe(true);
    delete value.events[6].matcherScore;
    expect(validateProgressRecord(value, validLesson).valid).toBe(true);
  });
  it('rejects an above-threshold no-match', () => {
    const value = progress();
    value.events[6].matcherScore = 0.73;
    expectIssue(validateProgressRecord(value, validLesson), 'integrity', 'matcher.above-threshold', '/events/6/matcherScore');
  });
  it.each([-0.1, 1.1])('rejects out-of-range confidence %s', score => {
    const packageValue = lesson();
    const recordValue = progress();
    packageValue.matcher.confidenceThreshold = score;
    recordValue.events[5].matcherScore = score;
    const code = score < 0 ? 'schema.minimum' : 'schema.maximum';
    expectIssue(validateLessonPackage(packageValue), 'schema', code, '/matcher/confidenceThreshold');
    expectIssue(validateProgressRecord(recordValue), 'schema', code, '/events/5/matcherScore');
  });

  it.each(['exportedAt', 'timestamp', 'askedAt'])('rejects invalid date-time in %s', field => {
    const value = progress();
    const target = field === 'timestamp' ? value.events[0] : field === 'askedAt' ? value.queuedQuestions[0] : value;
    target[field] = '2026-02-30T12:00:00Z';
    const path = field === 'timestamp' ? '/events/0/timestamp' : field === 'askedAt' ? '/queuedQuestions/0/askedAt' : '/exportedAt';
    expectIssue(validateProgressRecord(value), 'schema', 'schema.format', path);
  });
  it.each(['answer', 'sourceRefs'])('requires %s for an answered queue entry', field => {
    const value = progress();
    delete value.queuedQuestions[1][field];
    expectIssue(validateProgressRecord(value), 'schema', 'schema.required', '/queuedQuestions/1/' + field);
  });
  it('rejects empty answered-question sources and answer text on an unanswered question', () => {
    const value = progress();
    value.queuedQuestions[1].sourceRefs = [];
    expectIssue(validateProgressRecord(value), 'schema', 'schema.minItems', '/queuedQuestions/1/sourceRefs');
    const unanswered = progress();
    unanswered.queuedQuestions[0].answer = 'An uncited answer';
    expectIssue(validateProgressRecord(unanswered), 'schema', 'schema.additionalProperties', '/queuedQuestions/0/answer');
  });
  it.each(['', '/events/0', '/queuedQuestions/0', '/queuedQuestions/1'])('rejects extra progress properties at %s', path => {
    const value = progress();
    const target = path === '' ? value : path === '/events/0' ? value.events[0] : value.queuedQuestions[Number(path.at(-1))];
    target.unexpected = true;
    expectIssue(validateProgressRecord(value), 'schema', 'schema.additionalProperties', path + '/unexpected');
  });
  it.each([['variant-viewed', 'variantId'], ['question-matched', 'matcherScore'], ['quiz-answered', 'correctness'], ['tryit-follow-up', 'text']])('requires event-specific context for %s', (type, field) => {
    const value = progress();
    const index = value.events.findIndex((event: Fixture) => event.type === type);
    delete value.events[index][field];
    expectIssue(validateProgressRecord(value), 'schema', 'schema.required', `/events/${index}/${field}`);
  });
  it('rejects invalid context lessons with a prefixed error path', () => {
    const context = lesson();
    context.questionBank[0].sourceRefs = ['missing'];
    expectIssue(validateProgressRecord(progress(), context as LessonPackage), 'integrity', 'reference.source', '/lesson/questionBank/0/sourceRefs/0');
    const malformed = {} as LessonPackage;
    expectIssue(validateProgressRecord(progress(), malformed), 'schema', 'schema.required', '/lesson/schemaVersion');
  });
});

describe('offline validation', () => {
  it('executes with HTTP, HTTPS, fetch, and socket connections disabled', () => {
    expect(() => http.get('http://example.invalid')).toThrow('Network access is disabled');
    expect(() => https.get('https://example.invalid')).toThrow('Network access is disabled');
    expect(() => fetch('https://example.invalid')).toThrow('Network access is disabled');
    expect(() => new net.Socket().connect(80, 'example.invalid')).toThrow('Network access is disabled');
    expect(validateLessonPackage(lesson()).valid).toBe(true);
    expect(validateProgressRecord(progress(), validLesson).valid).toBe(true);
  });
});
