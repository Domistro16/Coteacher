import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { approveLessons, approvePersonalizedVisuals, audioBase64, cueForStep, demoLessons, OpusContainer, personalizedReplay, reviewRecording, startPresentation, type LessonRecording } from '@coteacher/shared';
import type { TutorInput, TutorProvider, GeneratedAnswer, CheckInput, GeneratedCheck } from '../delivery/tutor-provider';
import { preparedClip } from '../apps/student/src/Narrator';

/** Explicit test provider: reuses an audible prepared clip, never represents a live API call. */
export class MockTutor implements TutorProvider {
  engine = 'mock' as const; model = 'test-prepared-response'; inputs: TutorInput[] = [];
  checkInputs: CheckInput[] = [];
  fail = false; invalidCitation = false; lastText = '';
  async answer(input: TutorInput): Promise<GeneratedAnswer> {
    this.inputs.push(structuredClone(input)); if (this.fail) throw new Error('Simulated outage');
    const source = input.sources.find(source => preparedClip(source.excerpt)) ?? input.sources[0];
    this.lastText = source.excerpt;
    return { supported: true, safe: true, confident: true, text: source.excerpt,
      sourceIds: [this.invalidCitation ? 'invented-source' : source.sourceId], quotes: [source.excerpt], visualAssetId: input.visuals.find(visual => /pencil|diagram/.test(visual.id))?.id ?? null };
  }
  async speak(text: string) { const clip = preparedClip(text); if (!clip) throw new Error('No mock clip'); return new Uint8Array(await readFile(resolve('apps/student/public' + clip))); }
  async transcribe() { return 'Why does light change direction when it enters water?'; }
  async check(input: CheckInput): Promise<GeneratedCheck> {
    this.checkInputs.push(structuredClone(input)); if (this.fail) throw new Error('Simulated check outage');
    const lens = /lens|lenses/i.test(input.question), water = /water|bend|direction/i.test(input.question);
    const source = lens ? input.sources.find(s => s.sourceId === 'nasa-spaceplace-lenses') : input.sources.find(s => s.excerpt.includes(water ? 'direction' : 'straight')) ?? input.sources[0];
    return { supported: Boolean(source), confident: Boolean(source), safe: true,
      prompt: (input.personalization.mode === 'guided' ? 'Think about the path of the light. ' : input.personalization.mode === 'application' ? 'Apply the same idea to another ray. ' : '') + (lens ? 'What happens to light passing through a lens?' : water ? 'What can happen to light crossing from air into water at an angle?' : 'How does light travel in one uniform material?'),
      options: lens ? ['The light can bend.', 'The lens physically bends.'] : water ? ['Its direction can change.', 'It always keeps the same direction.'] : ['Along a straight path.', 'Always along a curved path.'],
      correctIndex: 0, explanation: source?.excerpt ?? 'No reliable support.', sourceIds: [this.invalidCitation ? 'invented-source' : source?.sourceId ?? 'missing'], quotes: [source?.excerpt ?? 'No reliable support.'] };
  }
}
export function tutorPackages() {
  const lessons = approveLessons(demoLessons(), true, '2026-10-09T10:00:00Z').map(lesson => startPresentation(lesson, 'step-light', '2026-10-09T10:00:01Z', 'tutor-class'));
  const header = new Uint8Array(19); header.set(new TextEncoder().encode('OpusHead')); header[8] = 1; header[9] = 1;
  const view = new DataView(header.buffer); view.setUint16(10, 312, true); view.setUint32(12, 48000, true);
  const opus = new OpusContainer(); for (let index = 0; index < 101; index++) opus.add(new Uint8Array([248, 255, 254]), 20000, index ? undefined : header);
  const raw: LessonRecording = { id: 'tutor-recording', lessonId: lessons[0].lessonId, classroomSessionId: 'tutor-class', lessonApprovedAt: '2026-10-09T10:00:00Z', startedAt: '2026-10-09T10:00:02Z', durationMs: 2000, origin: 'teacher-microphone',
    audio: { mimeType: 'audio/ogg;codecs=opus', sampleRate: 48000, channels: 1, mediaKey: audioBase64(new Uint8Array(32).fill(1)), dataBase64: audioBase64(opus.finish(96000, 48000)) },
    cues: [cueForStep(lessons[0], 'step-light', 0), cueForStep(lessons[0], 'step-refraction', 1000)], review: { status: 'draft' } };
  const recording = approvePersonalizedVisuals(reviewRecording(raw, true, '2026-10-09T10:00:04Z'), true, '2026-10-09T10:00:05Z');
  return lessons.map(lesson => personalizedReplay(lesson, recording));
}
