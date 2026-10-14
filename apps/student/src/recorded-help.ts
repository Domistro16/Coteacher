import { matchQuestion, recordingCueAt, requirePublishedLesson, type LessonPackage, type ProgressRecord, type VisualAsset, type VisualExploredEvent } from '@coteacher/shared';
import { handleStudentRequest } from './help';
import { createPlayerModel, transitionPlayer, type PlayerState } from './player';

function context(lesson: LessonPackage, progress: ProgressRecord, positionMs: number) {
  requirePublishedLesson(lesson);
  if (!lesson.recording || !lesson.playback) throw new Error('Collect reviewed recorded playback before exploring its visuals.');
  if (lesson.studentId !== progress.studentId || lesson.lessonId !== progress.lessonId) throw new Error('Progress belongs to a different learner or lesson.');
  const position = Math.max(0, Math.min(lesson.recording.durationMs, Math.round(positionMs)));
  const cue = recordingCueAt(lesson.recording, position);
  return { cue, position, recording: lesson.recording };
}

/** Rotate prepared representations using this learner's own recorded interactions. */
export function nextRecordedVisual(lesson: LessonPackage, progress: ProgressRecord, positionMs: number): VisualAsset | undefined {
  const { cue, recording } = context(lesson, progress, positionMs);
  const assigned = lesson.playback!.sequence[recording.cues.indexOf(cue)].visualAssetId;
  const seen = new Set([assigned]);
  for (const event of progress.events) if (event.type === 'visual-explored' && event.recordingId === recording.id && event.timelineStepId === cue.timelineStepId) seen.add(event.visualAssetId);
  return lesson.visualAssets!.find(asset => asset.conceptId === cue.conceptId && !seen.has(asset.id));
}

export function exploreRecordedVisual(lesson: LessonPackage, player: PlayerState, progress: ProgressRecord,
  positionMs: number, visualAssetId: string, timestamp: string, origin: VisualExploredEvent['origin'] = 'learner-choice') {
  const { cue, position, recording } = context(lesson, progress, positionMs);
  const asset = lesson.visualAssets?.find(entry => entry.id === visualAssetId && entry.conceptId === cue.conceptId);
  if (!asset) throw new Error('This approved representation does not belong to the current recorded concept.');
  const event: VisualExploredEvent = { type: 'visual-explored', timestamp, conceptId: cue.conceptId, timelineStepId: cue.timelineStepId,
    recordingId: recording.id, positionMs: position, visualAssetId: asset.id, sourceRefs: [...asset.sourceRefs], origin };
  return { player: { ...player, recording: { recordingId: recording.id, positionMs: position,
    support: { timelineStepId: cue.timelineStepId, visualAssetId: asset.id } } },
    progress: { ...progress, events: [...progress.events, event] } };
}

/** Help always uses native recorded time, even if the study pane is at another step. */
export function adaptRecordedMoment(lesson: LessonPackage, player: PlayerState, progress: ProgressRecord,
  positionMs: number, detail: string, timestamp: string, questionId: () => string, preferredVisualId?: string) {
  const { cue, position, recording } = context(lesson, progress, positionMs);
  const preferred = preferredVisualId ? lesson.visualAssets?.find(asset => asset.id === preferredVisualId && asset.conceptId === cue.conceptId) : undefined;
  if (preferredVisualId && !preferred) throw new Error('This approved representation does not belong to the current recorded concept.');
  const model = createPlayerModel(lesson);
  const current = model.steps[player.timelineIndex];
  const destination = current.step.id === cue.timelineStepId ? { player, events: [] }
    : transitionPlayer(model, player, { type: 'revisit-step', timelineStepId: cue.timelineStepId }, timestamp);
  const grounded = { ...progress, events: [...progress.events, ...destination.events] };
  // Typed questions are questions, not voice commands. Match the original text
  // directly and retain it verbatim, including punctuation and whitespace.
  const next = handleStudentRequest(model, destination.player, grounded, 'explain again', timestamp, questionId);
  if (detail.trim()) {
    const recordedContext = { studentId: lesson.studentId, lessonId: lesson.lessonId,
      conceptId: cue.conceptId, recordingId: recording.id, positionMs: position };
    const result = matchQuestion(detail, cue.timelineStepId, {
      ...lesson, questionBank: lesson.questionBank.filter(question => question.conceptId === cue.conceptId),
    });
    if ('match' in result) {
      next.progress.events.push({ type: 'question-matched', timestamp, conceptId: cue.conceptId,
        timelineStepId: cue.timelineStepId, questionId: result.match.id, matcherScore: result.score,
        originalText: detail, recordedContext });
      next.response.question = { text: result.match.answer, refs: [...result.match.sourceRefs],
        step: cue.timelineStepId, status: 'prepared', questionId: result.match.id };
    } else {
      const id = questionId();
      next.progress.events.push({ type: 'question-no-match', timestamp, conceptId: cue.conceptId,
        timelineStepId: cue.timelineStepId, questionId: id, matcherScore: result.score });
      next.progress.queuedQuestions.push({ id, text: detail, askedAt: timestamp,
        timelineStepId: cue.timelineStepId, answered: false, recordedContext });
      next.response.question = { text: lesson.matcher.noMatchMessage, refs: [], status: 'pending', questionId: id };
    }
    const completed = [...progress.events].reverse().find(event => event.type === 'tryit-completed' && event.timelineStepId === cue.timelineStepId);
    if (completed?.type === 'tryit-completed') next.progress.events.push({ type: 'tryit-follow-up', timestamp,
      conceptId: cue.conceptId, timelineStepId: cue.timelineStepId, variantId: completed.variantId, text: detail,
      ...('noMatch' in result ? { questionId: next.response.question!.questionId } : {}) });
  }
  const prior = player.recording?.support;
  // Exhaustion is not a missing-media state. Retain the existing support, or
  // reopen the assigned approved representation after the prior panel closed.
  const assigned = lesson.playback!.sequence[recording.cues.indexOf(cue)].visualAssetId;
  const asset = preferred ?? nextRecordedVisual(lesson, next.progress, position) ??
    (prior?.timelineStepId === cue.timelineStepId ? undefined : lesson.visualAssets!.find(entry => entry.id === assigned));
  next.player = { ...next.player, recording: { recordingId: recording.id, positionMs: position,
    ...(prior?.timelineStepId === cue.timelineStepId ? { support: prior } : {}) } };
  return asset ? { ...next, ...exploreRecordedVisual(lesson, next.player, next.progress, position, asset.id, timestamp, 'prepared-help') } : next;
}
