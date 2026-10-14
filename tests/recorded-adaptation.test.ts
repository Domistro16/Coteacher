import { describe, expect, it, vi } from 'vitest';
import { approvePersonalizedVisuals, audioBase64, cueForStep, demoLessons, emptyProgress, encodeRecordingWav,
  personalizedReplay, reviewRecording, startPresentation, validateLessonPackage, validateProgressRecord, mergeReturnedAnswers, simulatedAnswerProvider, type LessonRecording } from '@coteacher/shared';
import { adaptRecordedMoment, exploreRecordedVisual, nextRecordedVisual } from '../apps/student/src/recorded-help';
import { createPlayerModel, initialPlayerState } from '../apps/student/src/player';
import { saveStoredProfile } from '../apps/student/src/storage';

function fixture() {
  const lesson = startPresentation(demoLessons()[0], 'step-light', '2026-10-09T10:00:00Z', 'adaptation-class');
  const recording: LessonRecording = { id: 'adaptation-recording', lessonId: lesson.lessonId,
    classroomSessionId: lesson.classroomTimeline!.sessionId, lessonApprovedAt: lesson.classroomTimeline!.approvedAt,
    startedAt: '2026-10-09T10:00:01Z', durationMs: 2000, origin: 'teacher-microphone',
    audio: { mimeType: 'audio/wav', sampleRate: 16000, channels: 1,
      dataBase64: audioBase64(encodeRecordingWav([new Float32Array(32000).fill(.2)], 16000)) },
    cues: [cueForStep(lesson, 'step-light', 0), cueForStep(lesson, 'step-refraction', 1000)], review: { status: 'draft' } };
  const approved = approvePersonalizedVisuals(reviewRecording(recording, true, '2026-10-09T10:00:04Z'), true, '2026-10-09T10:00:05Z');
  const a = personalizedReplay(lesson, approved);
  const b = personalizedReplay({ ...lesson, studentId: 'student-b1c2d3e4' }, approved);
  return { a, b, approved, player: initialPlayerState(createPlayerModel(a)), progress: emptyProgress(a) };
}

describe('inspectable prepared playback decisions', () => {
  it('defaults when history is insufficient and lets supplied preference override a simulated difficulty', () => {
    const { b, approved } = fixture();
    const fallback = personalizedReplay(b, approved, {});
    expect(fallback.playback!.decision).toEqual({ difficulty: 'insufficient-history', representation: 'concrete-diagrams', basis: 'default' });
    expect(fallback.playback!.sequence[1].visualAssetId).toBe('refraction-pencil');
    const preference = personalizedReplay(b, approved, { difficulty: 'boundary-steps', preference: 'concrete-diagrams' });
    expect(preference.playback!.decision?.basis).toBe('learner-preference');
    expect(preference.recording).toBe(b.recording); expect(preference.objective).toEqual(b.objective);
    expect(validateLessonPackage(fallback).valid).toBe(true); expect(validateLessonPackage(preference).valid).toBe(true);
  });
  it('retains complete voice and chronology, packages all approved support geometry, and rejects changed decision metadata', () => {
    const { a, b } = fixture();
    expect(a.recording).toBe(b.recording); expect(a.visualAssets).toEqual(b.visualAssets);
    expect(a.playback!.decision?.difficulty).toBe('boundary-position');
    expect(b.playback!.decision?.difficulty).toBe('boundary-steps');
    expect(a.playback!.sequence[1].visualAssetId).not.toBe(b.playback!.sequence[1].visualAssetId);
    for (const modify of [
      (value: typeof a) => { delete value.playback!.decision; },
      (value: typeof a) => { value.playback!.decision!.representation = 'ordered-annotations'; },
      (value: typeof a) => { value.playback!.decision!.basis = 'default'; },
      (value: typeof a) => { value.visualAssets!.pop(); },
    ]) {
      const changed = structuredClone(a); modify(changed); expect(validateLessonPackage(changed).valid).toBe(false);
    }
  });
  it('continues validating legacy v1 packages without inventing extra reviewed visuals', () => {
    const { a } = fixture(); const legacy = structuredClone(a);
    delete legacy.playback!.decision; legacy.playback!.method = 'demo-history-rules-v1';
    legacy.playback!.reason = 'Simulated profile A: diagram and concrete-observation support after difficulty at the boundary.';
    legacy.visualAssets = legacy.visualAssets!.filter(asset => legacy.playback!.sequence.some(cue => cue.visualAssetId === asset.id)) as typeof legacy.visualAssets;
    expect(validateLessonPackage(legacy).valid).toBe(true);
    expect(nextRecordedVisual(legacy, emptyProgress(legacy), 1200)).toBeUndefined();
  });
});

describe('interaction adaptation at the exact recorded moment', () => {
  it('reopens approved support after exhaustion and validates the companion’s chosen spoken representation', () => {
    const { a, player, progress } = fixture();
    const first = adaptRecordedMoment(a, player, progress, 1300, '', '2026-10-09T10:00:10Z', () => 'unused');
    const seen = exploreRecordedVisual(a, first.player, first.progress, 1300, 'refraction-pencil', '2026-10-09T10:00:11Z');
    const closed = { ...seen.player, recording: { recordingId: a.recording!.id, positionMs: 1300 } };
    expect(nextRecordedVisual(a, seen.progress, 1300)).toBeUndefined();
    const reopened = adaptRecordedMoment(a, closed, seen.progress, 1300, '', '2026-10-09T10:00:12Z', () => 'unused');
    expect(reopened.player.recording?.support?.visualAssetId).toBe('refraction-pencil');
    expect(validateProgressRecord(reopened.progress, a).valid).toBe(true);
    const preferred = adaptRecordedMoment(a, player, progress, 1300, '', '2026-10-09T10:00:12Z', () => 'unused', 'refraction-pencil');
    expect(preferred.progress.events.filter(event => event.type === 'visual-explored')).toMatchObject([{ visualAssetId: 'refraction-pencil', positionMs: 1300 }]);
    expect(() => adaptRecordedMoment(a, player, progress, 1300, '', '2026-10-09T10:00:12Z', () => 'unused', 'light-path-steps')).toThrow('current recorded concept');
  });
  it('preserves original supported and unsupported questions with exact recorded context without interpreting commands', () => {
    const { a, player, progress } = fixture();
    const original = '  Why does the pencil look broken?  ';
    const matched = adaptRecordedMoment(a, player, progress, 1257, original, '2026-10-09T10:00:10Z', () => 'unexpected');
    expect(matched.response.question?.status).toBe('prepared');
    expect(matched.progress.events.find(event => event.type === 'question-matched')).toMatchObject({ originalText: original,
      recordedContext: { studentId: a.studentId, lessonId: a.lessonId, conceptId: 'refraction', recordingId: a.recording!.id, positionMs: 1257 } });
    const texts = ['  Can light swim?\nPlease explain!  ', 'this', 'replay'];
    let next = matched;
    texts.forEach((text, index) => { next = adaptRecordedMoment(a, next.player, next.progress, 1257, text, '2026-10-09T10:00:11Z', () => 'pending-' + index); });
    expect(next.progress.queuedQuestions.map(question => question.text)).toEqual(texts);
    expect(new Set(next.progress.queuedQuestions.map(question => question.id)).size).toBe(3);
    expect(next.response.question?.status).toBe('pending');
    expect(validateProgressRecord(next.progress, a).valid).toBe(true);
  });
  it('rejects changed question ownership, recording, concept and time while retaining old questions without invented timestamps', () => {
    const { a, b, player, progress } = fixture();
    const next = adaptRecordedMoment(a, player, progress, 1517, 'Should I use a glass cup for this activity?', '2026-10-09T10:00:10Z', () => 'pending-1');
    const mutations = [
      (context: any) => { context.studentId = b.studentId; },
      (context: any) => { context.lessonId = 'other'; },
      (context: any) => { context.conceptId = 'light-path'; },
      (context: any) => { context.recordingId = 'other-recording'; },
      (context: any) => { context.positionMs = 500; },
      (context: any) => { context.positionMs = 2001; },
    ];
    for (const change of mutations) {
      const record = structuredClone(next.progress); change(record.queuedQuestions[0].recordedContext);
      expect(validateProgressRecord(record, a).valid).toBe(false);
    }
    const legacy = structuredClone(next.progress); delete legacy.queuedQuestions[0].recordedContext;
    expect(validateProgressRecord(legacy, a).valid).toBe(true);
    const answered = structuredClone({ ...next.progress, queuedQuestions: next.progress.queuedQuestions.map(question => simulatedAnswerProvider.answer(question)) });
    expect(mergeReturnedAnswers(next.progress, answered, a).queuedQuestions[0].answered).toBe(true);
    answered.queuedQuestions[0].recordedContext!.positionMs = 1600;
    expect(validateProgressRecord(answered, a).valid).toBe(true); // still this concept, but a different moment
    expect(mergeReturnedAnswers(next.progress, answered, a).queuedQuestions[0].answered).toBe(false);
    expect(mergeReturnedAnswers(next.progress, { ...answered, queuedQuestions: answered.queuedQuestions.map(({ recordedContext, ...question }) => question) }, a).queuedQuestions[0].answered).toBe(false);
  });
  it('uses audio time instead of the study pane, matches specific confusion, selects sourced support and retains the voice', () => {
    const { a, player, progress } = fixture(); const before = structuredClone(a);
    const next = adaptRecordedMoment(a, player, progress, 1250, 'Why does the pencil look broken?', '2026-10-09T10:00:10Z', () => 'question-1');
    expect(next.player.timelineIndex).toBe(1); expect(next.player.variantId).toBe('refraction-short');
    expect(next.player.recording).toEqual({ recordingId: a.recording!.id, positionMs: 1250,
      support: { timelineStepId: 'step-refraction', visualAssetId: 'refraction-steps' } });
    expect(next.response.question?.refs).toContain('notes-light'); expect(next.progress.queuedQuestions).toEqual([]);
    expect(next.progress.events.at(-1)).toMatchObject({ type: 'visual-explored', conceptId: 'refraction',
      timelineStepId: 'step-refraction', positionMs: 1250, sourceRefs: ['notes-light'] });
    expect(validateProgressRecord(next.progress, a).valid).toBe(true);
    expect(a).toEqual(before); expect(progress.events).toEqual([]);
  });
  it('uses each learner history for later explanation/visual suggestions and does not force an exhausted choice', () => {
    const { a, b, player, progress } = fixture();
    const first = adaptRecordedMoment(a, player, progress, 1300, '', '2026-10-09T10:00:10Z', () => 'question-1');
    const later = adaptRecordedMoment(a, first.player, first.progress, 1300, '', '2026-10-09T10:00:11Z', () => 'question-2');
    expect(later.player.variantId).toBe('refraction-analogy');
    expect(nextRecordedVisual(a, later.progress, 1300)).toBeUndefined();
    expect(later.progress.events.filter(event => event.type === 'visual-explored')).toHaveLength(1);
    expect(nextRecordedVisual(b, emptyProgress(b), 1300)?.id).toBe('refraction-pencil');
    expect(() => nextRecordedVisual(b, first.progress, 1300)).toThrow('different learner');
  });
  it('queues unsupported specific confusion honestly at the recorded step and keeps alternatives source-grounded', () => {
    const { a, player, progress } = fixture();
    const next = adaptRecordedMoment(a, player, progress, 1500, 'Why do clouds resemble elephants?', '2026-10-09T10:00:10Z', () => 'question-1');
    expect(next.response.question?.text).toContain('do not have a prepared answer');
    expect(next.progress.queuedQuestions).toMatchObject([{ text: 'Why do clouds resemble elephants?', timelineStepId: 'step-refraction', answered: false,
      recordedContext: { studentId: a.studentId, lessonId: a.lessonId, conceptId: 'refraction', recordingId: a.recording!.id, positionMs: 1500 } }]);
    expect(validateProgressRecord(next.progress, a).valid).toBe(true);
  });
  it('rejects foreign visuals, recording IDs, timestamps, source references and saved paused support', async () => {
    const { a, player, progress } = fixture();
    expect(() => exploreRecordedVisual(a, player, progress, 1300, 'light-path-steps', '2026-10-09T10:00:10Z')).toThrow('current recorded concept');
    const next = exploreRecordedVisual(a, player, progress, 1300, 'refraction-steps', '2026-10-09T10:00:10Z');
    for (const modify of [
      (event: any) => { event.recordingId = 'other'; },
      (event: any) => { event.positionMs = 2001; },
      (event: any) => { event.positionMs = 900; },
      (event: any) => { event.visualAssetId = 'light-path-steps'; },
      (event: any) => { event.sourceRefs = ['notes-activity']; },
    ]) {
      const changed = structuredClone(next.progress); modify(changed.events[0]); expect(validateProgressRecord(changed, a).valid).toBe(false);
    }
    const open = vi.fn(() => { throw new Error('Invalid support must not reach storage'); });
    vi.stubGlobal('indexedDB', { open });
    try {
      const badPlayer = { ...next.player, recording: { ...next.player.recording, support: { timelineStepId: 'step-light', visualAssetId: 'light-path-steps' } } };
      await expect(saveStoredProfile(a.studentId, '111111', { lesson: a, progress: next.progress, player: badPlayer })).rejects.toThrow('recorded moment');
      expect(open).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
