import { describe, expect, it } from 'vitest';
import { approveLessons, approvePersonalizedVisuals, audioBase64, checkPersonalizedReplay, cueForStep, demoLessons,
  encodeRecordingWav, personalizedReplay, requirePublishedLesson, reviewRecording, startPresentation,
  validateLessonPackage, type LessonRecording } from '@coteacher/shared';
import { createPlayerModel, initialPlayerState, reducePlayerState } from '../apps/student/src/player';

function fixture() {
  const lesson = startPresentation(demoLessons()[0], 'step-light', '2026-10-09T10:00:00Z', 'test-class');
  const recording: LessonRecording = { id: 'recording-test', lessonId: lesson.lessonId, classroomSessionId: 'test-class',
    lessonApprovedAt: lesson.publication.status === 'approved' ? lesson.publication.approvedAt : '',
    startedAt: '2026-10-09T10:00:01Z', durationMs: 2000, origin: 'teacher-microphone',
    audio: { mimeType: 'audio/wav', sampleRate: 16000, channels: 1, dataBase64: audioBase64(encodeRecordingWav([new Float32Array(32000).fill(.2)],16000)) },
    cues: [cueForStep(lesson, 'step-light', 0), cueForStep(lesson, 'step-refraction', 1000)], review: { status: 'draft' } };
  return { lesson, recording };
}
describe('reviewed personalized replay contract', () => {
  it('preserves complete recording, chronology, objective and sources while changing actual visual geometry', () => {
    const { lesson, recording } = fixture();
    const reviewed = approvePersonalizedVisuals(reviewRecording(recording, true, '2026-10-09T10:00:04Z'), true, '2026-10-09T10:00:05Z');
    const a = requirePublishedLesson(personalizedReplay(lesson, reviewed));
    const b = requirePublishedLesson(personalizedReplay({ ...lesson, studentId: 'student-b1c2d3e4' }, reviewed));
    expect(a.recording).toBe(b.recording); expect(a.objective).toEqual(b.objective);
    expect(a.playback!.sequence.map(({visualAssetId,...cue}) => cue)).toEqual(b.playback!.sequence.map(({visualAssetId,...cue}) => cue));
    const selectedLayers = (lesson: typeof a) => lesson.playback!.sequence.map(cue => lesson.visualAssets!.find(asset => asset.id === cue.visualAssetId)!.layers);
    expect(selectedLayers(a)).not.toEqual(selectedLayers(b));
    expect(a.visualAssets).toEqual(b.visualAssets); // Both also carry the approved alternatives for paused help.
    expect(a.visualAssets!.every(asset => asset.sourceRefs.includes('notes-light'))).toBe(true);
    expect(a.playback!.simulated).toBe(true); expect(a.recording!.audio.mediaKey).toEqual(b.recording!.audio.mediaKey);
    expect(recording.audio.mediaKey).toBeUndefined();
  });
  it('rejects altered visuals, missing assets, wrong learner, sequence timing and recording relationships', () => {
    const { lesson, recording } = fixture();
    const original = personalizedReplay(lesson, recording);
    for (const modify of [
      (value: any) => value.visualAssets.pop(),
      (value: any) => { value.visualAssets[0].layers[0].text = 'Unsourced claim'; },
      (value: any) => { value.playback.studentId = 'student-b1c2d3e4'; },
      (value: any) => { value.playback.sequence[1].offsetMs = 1100; },
      (value: any) => { value.playback.recordingId = 'other'; },
      (value: any) => { value.visualAssets[0].sourceRefs = ['invented']; },
      (value: any) => { value.visualAssets[0].layers[0].fill = 'url(https://remote.invalid/image)'; },
    ]) {
      const changed = structuredClone(original); modify(changed);
      expect(validateLessonPackage(changed).valid).toBe(false);
    }
    expect(checkPersonalizedReplay(original)).toBe(true);
  });
  it('gates both visual review and audio review and discards derived replay on lesson reapproval', () => {
    const { lesson, recording } = fixture();
    expect(() => approvePersonalizedVisuals(recording, true)).toThrow('Replay');
    const audioReviewed = reviewRecording(recording, true, '2026-10-09T10:00:04Z');
    expect(() => approvePersonalizedVisuals(audioReviewed, false)).toThrow('Replay');
    expect(() => requirePublishedLesson(personalizedReplay(lesson, audioReviewed))).toThrow('visual sequences');
    const approved = personalizedReplay(lesson, approvePersonalizedVisuals(audioReviewed, true, '2026-10-09T10:00:05Z'));
    const reset = approveLessons([approved],true)[0];
    expect(reset.recording).toBeUndefined(); expect(reset.playback).toBeUndefined(); expect(reset.visualAssets).toBeUndefined();
  });
  it('preserves the audio position through exact-concept study, alternative explanations and original return', () => {
    const { lesson } = fixture(); const model = createPlayerModel(lesson);
    const position = { recordingId: 'recording-test', positionMs: 1350 };
    let state = { ...initialPlayerState(model), recording: position };
    for (const action of [ { type: 'revisit-step', timelineStepId: 'step-refraction' }, { type: 'select-variant', variantId: 'refraction-short' }, { type: 'original' }, { type: 'navigate', direction: -1 } ] as const) {
      state = reducePlayerState(model, state, action) as typeof state; expect(state.recording).toEqual(position);
    }
  });
  it('does not publish a recording that omits a complete lesson concept', () => {
    const { lesson, recording } = fixture();
    recording.cues = [recording.cues[0]];
    const approved = approvePersonalizedVisuals(reviewRecording(recording, true, '2026-10-09T10:00:04Z'), true, '2026-10-09T10:00:05Z');
    expect(() => requirePublishedLesson(personalizedReplay(lesson, approved))).toThrow('every lesson concept');
  });
});
