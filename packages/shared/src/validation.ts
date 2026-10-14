import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import lessonSchema from '../../../schemas/lesson-package.schema.json' with { type: 'json' };
import progressSchema from '../../../schemas/progress-record.schema.json' with { type: 'json' };
import type { LessonPackage, Variant } from './generated/lesson-package';
import type { ProgressRecord, RecordedQuestionContext } from './generated/progress-record';
import { checkRecordingAudio, recordingCueAt } from './recording';
import { checkPersonalizedReplay } from './personalized-replay';

export interface ValidationIssue {
  stage: 'schema' | 'integrity';
  code: string;
  /** JSON Pointer, with an empty string representing the root. */
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; issues: ValidationIssue[] };

// Synchronous compilation of bundled schemas: no loader or remote resolution.
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const lessonShape = ajv.compile<LessonPackage>(lessonSchema);
const progressShape = ajv.compile<ProgressRecord>(progressSchema);

function pointerToken(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function schemaIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map(error => {
    const property = error.keyword === 'required' ? error.params.missingProperty
      : error.keyword === 'additionalProperties' ? error.params.additionalProperty
      : undefined;
    return {
      stage: 'schema',
      code: `schema.${error.keyword}`,
      path: error.instancePath + (property === undefined ? '' : '/' + pointerToken(property)),
      message: error.message ?? 'Invalid schema value',
    };
  });
}

function issue(issues: ValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ stage: 'integrity', code, path, message });
}

function register<T>(map: Map<string, T>, id: string, value: T, path: string, issues: ValidationIssue[]): void {
  if (map.has(id)) {
    issue(issues, 'duplicate.id', path, `Duplicate ID: ${id}`);
  } else {
    map.set(id, value);
  }
}

function indexById<T extends { id: string }>(items: T[], path: string, issues: ValidationIssue[]): Map<string, T> {
  const result = new Map<string, T>();
  items.forEach((item, i) => register(result, item.id, item, `${path}/${i}/id`, issues));
  return result;
}

function reference<T>(map: Map<string, T>, id: string, kind: string, path: string, issues: ValidationIssue[]): T | undefined {
  const item = map.get(id);
  if (item === undefined) issue(issues, `reference.${kind}`, path, `Unknown ${kind} ID: ${id}`);
  return item;
}

function checkSourceRefs(value: unknown, sources: Map<string, unknown>, issues: ValidationIssue[], path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => checkSourceRefs(item, sources, issues, `${path}/${i}`));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}/${pointerToken(key)}`;
      if (key === 'sourceRefs' && Array.isArray(child)) {
        child.forEach((id, i) => reference(sources, id, 'source', `${childPath}/${i}`, issues));
      } else {
        checkSourceRefs(child, sources, issues, childPath);
      }
    }
  }
}

type OwnedVariant = { variant: Variant; conceptId: string };

function lessonIndex(lesson: LessonPackage, issues: ValidationIssue[]) {
  const sources = indexById(lesson.sources, '/sources', issues);
  const concepts = indexById(lesson.concepts, '/concepts', issues);
  const timeline = indexById(lesson.timeline, '/timeline', issues);
  const questions = indexById(lesson.questionBank, '/questionBank', issues);
  const quiz = indexById(lesson.quiz, '/quiz', issues);
  const variants = new Map<string, OwnedVariant>();
  lesson.concepts.forEach((concept, c) => concept.variants.forEach((variant, v) => {
    register(variants, variant.id, { variant, conceptId: concept.id }, `/concepts/${c}/variants/${v}/id`, issues);
  }));
  return { sources, concepts, timeline, questions, quiz, variants };
}

type LessonIndex = ReturnType<typeof lessonIndex>;

function checkVariant(index: LessonIndex, variantId: string, conceptId: string, path: string, issues: ValidationIssue[]): OwnedVariant | undefined {
  const owned = reference(index.variants, variantId, 'variant', path, issues);
  if (owned && owned.conceptId !== conceptId) {
    issue(issues, 'context.variant-concept', path, `Variant ${variantId} belongs to concept ${owned.conceptId}, not ${conceptId}`);
  }
  return owned;
}

function checkStep(index: LessonIndex, stepId: string, conceptId: string, path: string, issues: ValidationIssue[]): void {
  const step = reference(index.timeline, stepId, 'timeline-step', path, issues);
  if (step && step.conceptId !== conceptId) {
    issue(issues, 'context.step-concept', path, `Step ${stepId} belongs to concept ${step.conceptId}, not ${conceptId}`);
  }
}

function lessonIntegrity(lesson: LessonPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const index = lessonIndex(lesson, issues);
  checkSourceRefs(lesson, index.sources, issues);
  lesson.objective.conceptIds.forEach((id, i) => {
    reference(index.concepts, id, 'concept', `/objective/conceptIds/${i}`, issues);
  });
  lesson.concepts.forEach((concept, c) => {
    concept.prerequisiteConceptIds.forEach((id, i) => {
      reference(index.concepts, id, 'concept', `/concepts/${c}/prerequisiteConceptIds/${i}`, issues);
    });
    concept.variants.forEach((variant, v) => {
      if (variant.type === 'tryit') {
        checkStep(index, variant.returnToStep, concept.id, `/concepts/${c}/variants/${v}/returnToStep`, issues);
      }
    });
  });
  lesson.timeline.forEach((step, i) => {
    reference(index.concepts, step.conceptId, 'concept', `/timeline/${i}/conceptId`, issues);
    checkVariant(index, step.defaultVariantId, step.conceptId, `/timeline/${i}/defaultVariantId`, issues);
  });
  const classroom = lesson.classroomTimeline;
  if (classroom) {
    if (lesson.publication.status !== 'approved' || classroom.approvedAt !== lesson.publication.approvedAt) {
      issue(issues, 'classroom.approval', '/classroomTimeline/approvedAt', 'Classroom presentation must belong to this approved lesson revision');
    }
    reference(index.timeline, classroom.currentStepId, 'timeline-step', '/classroomTimeline/currentStepId', issues);
    let previous = Date.parse(classroom.startedAt);
    if (lesson.publication.status === 'approved' && previous < Date.parse(lesson.publication.approvedAt)) {
      issue(issues, 'classroom.time', '/classroomTimeline/startedAt', 'Presentation cannot precede lesson approval');
    }
    classroom.visits.forEach((visit, i) => {
      const path = `/classroomTimeline/visits/${i}`;
      reference(index.concepts, visit.conceptId, 'concept', `${path}/conceptId`, issues);
      checkStep(index, visit.timelineStepId, visit.conceptId, `${path}/timelineStepId`, issues);
      const time = Date.parse(visit.presentedAt);
      if (time < previous || (i === 0 && time !== previous)) {
        issue(issues, 'classroom.time', `${path}/presentedAt`, 'Presentation visits must start at startedAt and remain chronological');
      }
      previous = time;
    });
    if (classroom.currentStepId !== classroom.visits.at(-1)!.timelineStepId) {
      issue(issues, 'classroom.position', '/classroomTimeline/currentStepId', 'Presentation position must match its last visit');
    }
  }
  const recording = lesson.recording;
  if (recording) {
    if (recording.lessonId !== lesson.lessonId || lesson.publication.status !== 'approved'
      || recording.lessonApprovedAt !== lesson.publication.approvedAt
      || !classroom || recording.classroomSessionId !== classroom.sessionId) {
      issue(issues, 'recording.revision', '/recording', 'Audio must belong to this lesson and approved presentation revision');
    }
    if ((lesson.publication.status === 'approved' && Date.parse(recording.startedAt) < Date.parse(lesson.publication.approvedAt))
      || (recording.review.status === 'approved' && Date.parse(recording.review.reviewedAt) < Date.parse(recording.startedAt))) {
      issue(issues, 'recording.time', '/recording/startedAt', 'Capture and review must follow lesson approval');
    }
    if (!checkRecordingAudio(recording)) issue(issues, 'recording.audio', '/recording/audio', 'Expected complete WAV or checksummed Opus audio with matching duration');
    if ('mediaUrl' in recording.audio && !recording.audio.mediaUrl.startsWith(`/api/recorded-lessons/${recording.audio.sha256}/audio?key=`)) {
      issue(issues, 'recording.remote-identity', '/recording/audio/mediaUrl', 'Delivered audio must address its declared checksum');
    }
    if (recording.visualReview?.status === 'approved' && Date.parse(recording.visualReview.reviewedAt) < Date.parse(recording.startedAt)) {
      issue(issues, 'recording.visual-review', '/recording/visualReview', 'Visual review must follow recording');
    }
    let previous = 0;
    recording.cues.forEach((cue, i) => {
      const path = `/recording/cues/${i}`;
      checkStep(index, cue.timelineStepId, cue.conceptId, `${path}/timelineStepId`, issues);
      const step = index.timeline.get(cue.timelineStepId);
      if (step && JSON.stringify(cue.sourceRefs) !== JSON.stringify(step.sourceRefs)) {
        issue(issues, 'recording.sources', `${path}/sourceRefs`, 'Recorded visuals retain the approved moment source references');
      }
      if ((i === 0 && cue.offsetMs !== 0) || cue.offsetMs < previous || cue.offsetMs > recording.durationMs) {
        issue(issues, 'recording.timeline', `${path}/offsetMs`, 'Audio cues must begin at zero and remain ordered within the audio');
      }
      previous = cue.offsetMs;
    });
  }
  if (!checkPersonalizedReplay(lesson)) issue(issues, 'playback.assets', '/playback', 'Personal visual assets and sequence must match the reviewed catalog, learner and recording cues');
  lesson.questionBank.forEach((question, i) => {
    reference(index.concepts, question.conceptId, 'concept', `/questionBank/${i}/conceptId`, issues);
    checkStep(index, question.timelineStepId, question.conceptId, `/questionBank/${i}/timelineStepId`, issues);
  });
  lesson.quiz.forEach((quiz, i) => {
    reference(index.concepts, quiz.conceptId, 'concept', `/quiz/${i}/conceptId`, issues);
    if (quiz.correctIndex >= quiz.options.length) {
      issue(issues, 'quiz.correct-index', `/quiz/${i}/correctIndex`, 'correctIndex must be within options');
    }
  });

  const routed = new Set(lesson.route.conceptOrder);
  lesson.route.conceptOrder.forEach((id, i) => {
    reference(index.concepts, id, 'concept', `/route/conceptOrder/${i}`, issues);
  });
  lesson.objective.conceptIds.forEach(id => {
    if (!routed.has(id)) issue(issues, 'route.objective-coverage', '/route/conceptOrder', `Route does not cover objective concept ${id}`);
  });
  const conceptRoutes = new Set<string>();
  lesson.route.conceptRoutes.forEach((entry, i) => {
    const path = `/route/conceptRoutes/${i}`;
    reference(index.concepts, entry.conceptId, 'concept', `${path}/conceptId`, issues);
    if (conceptRoutes.has(entry.conceptId)) issue(issues, 'route.duplicate-concept', `${path}/conceptId`, 'Concept has multiple route entries');
    conceptRoutes.add(entry.conceptId);
    if (!routed.has(entry.conceptId)) issue(issues, 'route.unordered-concept', `${path}/conceptId`, 'Route entry is absent from conceptOrder');
    entry.variantOrder.forEach((id, v) => checkVariant(index, id, entry.conceptId, `${path}/variantOrder/${v}`, issues));
  });
  routed.forEach(id => {
    if (!conceptRoutes.has(id)) issue(issues, 'route.missing-concept', '/route/conceptRoutes', `No variant route for ${id}`);
  });
  lesson.route.insertedRefreshers.forEach((entry, i) => {
    const path = `/route/insertedRefreshers/${i}`;
    reference(index.concepts, entry.conceptId, 'concept', `${path}/conceptId`, issues);
    reference(index.concepts, entry.beforeConceptId, 'concept', `${path}/beforeConceptId`, issues);
    if (!routed.has(entry.beforeConceptId)) issue(issues, 'route.refresher-target', `${path}/beforeConceptId`, 'Refresher target is absent from conceptOrder');
    const owned = checkVariant(index, entry.variantId, entry.conceptId, `${path}/variantId`, issues);
    if (owned && owned.variant.type !== 'refresher') issue(issues, 'route.refresher-type', `${path}/variantId`, 'Inserted variant must be a refresher');
  });
  return issues;
}

/** Validate both shape and relationships. Consumers must use this at file boundaries. */
export function validateLessonPackage(value: unknown): ValidationResult<LessonPackage> {
  if (!lessonShape(value)) return { valid: false, issues: schemaIssues(lessonShape.errors) };
  const issues = lessonIntegrity(value);
  return issues.length ? { valid: false, issues } : { valid: true, data: value };
}

function progressIntegrity(progress: ProgressRecord, lesson?: LessonPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const queued = indexById(progress.queuedQuestions, '/queuedQuestions', issues);
  const eventIds = new Set<string>();
  progress.events.forEach((event, index) => {
    if (!event.eventId) return; // Existing saved ledgers remain readable.
    if (eventIds.has(event.eventId)) issue(issues, 'duplicate.event', `/events/${index}/eventId`, 'Event IDs must be unique within this learner lesson ledger');
    eventIds.add(event.eventId);
  });
  function checkQuestionContext(context: RecordedQuestionContext | undefined, stepId: string, path: string) {
    if (!context) return; // Older saved questions have no recoverable audio time.
    if (context.studentId !== progress.studentId || context.lessonId !== progress.lessonId) {
      issue(issues, 'identity.question', path, 'Question belongs to a different learner or lesson');
    }
    if (lesson) {
      const recording = lesson.recording;
      const cue = recording && context.positionMs <= recording.durationMs ? recordingCueAt(recording, context.positionMs) : undefined;
      if (!recording || context.recordingId !== recording.id || cue?.conceptId !== context.conceptId || cue?.timelineStepId !== stepId) {
        issue(issues, 'context.recorded-question', path, 'Question must retain its exact recorded concept and position');
      }
    }
  }
  progress.queuedQuestions.forEach((question, i) => checkQuestionContext(question.recordedContext, question.timelineStepId, `/queuedQuestions/${i}/recordedContext`));
  progress.events.forEach((event, i) => {
    if (event.type === 'question-matched') checkQuestionContext(event.recordedContext, event.timelineStepId, `/events/${i}/recordedContext`);
  });
  progress.events.forEach((event, i) => {
    if (event.type === 'question-no-match' || (event.type === 'tryit-follow-up' && event.questionId !== undefined)) {
      const question = reference(queued, event.questionId!, 'queued-question', `/events/${i}/questionId`, issues);
      if (question && question.timelineStepId !== event.timelineStepId) {
        issue(issues, 'context.queued-question-step', `/events/${i}/questionId`, 'Queued question and event have different timeline steps');
      }
    }
  });
  if (!lesson) return issues;

  if (progress.lessonId !== lesson.lessonId) issue(issues, 'identity.lesson', '/lessonId', 'Progress belongs to a different lesson');
  if (progress.studentId !== lesson.studentId) issue(issues, 'identity.student', '/studentId', 'Progress belongs to a different student');
  const index = lessonIndex(lesson, issues);
  checkSourceRefs(progress, index.sources, issues);
  progress.queuedQuestions.forEach((question, i) => {
    reference(index.timeline, question.timelineStepId, 'timeline-step', `/queuedQuestions/${i}/timelineStepId`, issues);
  });
  progress.events.forEach((event, i) => {
    const path = `/events/${i}`;
    reference(index.concepts, event.conceptId, 'concept', `${path}/conceptId`, issues);
    if ('timelineStepId' in event) checkStep(index, event.timelineStepId, event.conceptId, `${path}/timelineStepId`, issues);
    if ('variantId' in event) {
      const owned = checkVariant(index, event.variantId, event.conceptId, `${path}/variantId`, issues);
      if (owned && (event.type === 'tryit-completed' || event.type === 'tryit-follow-up') && owned.variant.type !== 'tryit') {
        issue(issues, 'context.tryit-variant', `${path}/variantId`, 'Try it event must reference a tryit variant');
      }
    }
    if (event.type === 'question-matched') {
      const question = reference(index.questions, event.questionId, 'question', `${path}/questionId`, issues);
      if (question && (question.conceptId !== event.conceptId || question.timelineStepId !== event.timelineStepId)) {
        issue(issues, 'context.question', `${path}/questionId`, 'Event context differs from the matched answer context');
      }
      if (event.matcherScore <= lesson.matcher.confidenceThreshold) {
        issue(issues, 'matcher.below-threshold', `${path}/matcherScore`, 'Matched score must exceed the confidence threshold');
      }
    }
    if (event.type === 'question-no-match' && event.matcherScore !== undefined && event.matcherScore > lesson.matcher.confidenceThreshold) {
      issue(issues, 'matcher.above-threshold', `${path}/matcherScore`, 'No-match score must not exceed the confidence threshold');
    }
    if (event.type === 'quiz-answered') {
      const quiz = reference(index.quiz, event.quizId, 'quiz', `${path}/quizId`, issues);
      if (quiz && quiz.conceptId !== event.conceptId) issue(issues, 'context.quiz-concept', `${path}/quizId`, 'Quiz and event have different concepts');
      if (quiz && event.selectedIndex !== undefined && (event.selectedIndex >= quiz.options.length || event.correctness !== (event.selectedIndex === quiz.correctIndex))) {
        issue(issues, 'context.quiz-answer', `${path}/selectedIndex`, 'Saved answer and correctness must match the prepared check');
      }
      if (quiz && event.sourceRefs && JSON.stringify(event.sourceRefs) !== JSON.stringify(quiz.sourceRefs)) {
        issue(issues, 'context.quiz-sources', `${path}/sourceRefs`, 'Saved check sources must match the prepared question');
      }
    }
    if (event.type === 'visual-explored') {
      const asset = lesson.visualAssets?.find(entry => entry.id === event.visualAssetId);
      const recording = lesson.recording;
      if (!asset || asset.conceptId !== event.conceptId || JSON.stringify(asset.sourceRefs) !== JSON.stringify(event.sourceRefs)) {
        issue(issues, 'context.visual', `${path}/visualAssetId`, 'Visual exploration must use the current concept and its approved sources');
      }
      if (!recording || recording.id !== event.recordingId || event.positionMs > recording.durationMs
        || (recording && recordingCueAt(recording, event.positionMs).timelineStepId !== event.timelineStepId)) {
        issue(issues, 'context.recorded-visual', `${path}/positionMs`, 'Visual exploration must belong to the exact recorded moment');
      }
    }
  });
  return issues;
}

/** Without a lesson, cross-file references cannot be verified. */
export function validateProgressRecord(value: unknown, lesson?: LessonPackage): ValidationResult<ProgressRecord> {
  if (!progressShape(value)) return { valid: false, issues: schemaIssues(progressShape.errors) };
  if (lesson !== undefined) {
    const context = validateLessonPackage(lesson);
    if (!context.valid) return { valid: false, issues: context.issues.map(error => ({ ...error, path: '/lesson' + error.path })) };
  }
  const issues = progressIntegrity(value, lesson);
  return issues.length ? { valid: false, issues } : { valid: true, data: value };
}
