import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { decryptPayload, encryptPayload, emptyProgress, initialTutorState, deferTutorSpeech, restoreDeferredTutorSpeech, validTutorState, type TutorReply, type TutorState } from '@coteacher/shared';
import { LessonDeliveryStore } from '../delivery/store';
import { ProgressReturnStore } from '../delivery/progress-store';
import { TutorStore } from '../delivery/tutor-store';
import { MockTutor, tutorPackages } from './tutor-fixture';

function speechState() {
  const state = initialTutorState(tutorPackages()[0]);
  const reply: TutorReply = { questionId: 'question', originalText: 'Why does light bend?', conceptId: 'refraction', timelineStepId: 'step-refraction', positionMs: 1300,
    status: 'answered', text: 'Light changes direction at the boundary.', citations: [], sourceRefs: [], visualAssetId: null,
    engine: 'mock', model: 'test', updatedAt: '2026-10-26T10:00:00Z', speechBase64: 'YXVkaW8=', review: 'unreviewed' };
  state.replies.push(reply); return state;
}
describe('live text delivery preserves downloaded speech', () => {
  it('projects only response audio and restores identical local clips without mutating either record', () => {
    const original = speechState(), before = JSON.stringify(original), deferred = deferTutorSpeech(original);
    expect(deferred.replies[0].speechBase64).toBeNull();
    expect(JSON.stringify(original)).toBe(before);
    const restored = restoreDeferredTutorSpeech(deferred, original);
    expect(restored).toEqual(original);
    expect(deferred.replies[0].speechBase64).toBeNull();
    // Finishing generation may advance the update time without changing speech content.
    deferred.replies[0].updatedAt = '2026-10-26T10:01:00Z';
    expect(restoreDeferredTutorSpeech(deferred, original).replies[0].speechBase64).toBe('YXVkaW8=');
  });
  it('does not restore stale, flagged, cross-profile or cross-recording audio', () => {
    const original = speechState();
    for (const change of [{ text: 'A revised answer.' }, { review: 'flagged' }, { sourceRefs: ['changed-source'] }, { originalText: 'A different question' }]) {
      const deferred = deferTutorSpeech(original); Object.assign(deferred.replies[0], change);
      expect(restoreDeferredTutorSpeech(deferred, original).replies[0].speechBase64).toBeNull();
    }
    expect(() => restoreDeferredTutorSpeech({ ...original, studentId: 'another' }, original)).toThrow('different learner');
    expect(() => restoreDeferredTutorSpeech({ ...original, recordingId: 'another' }, original)).toThrow('different learner');
  });
  it('returns encrypted text projections and restores full audio without stripping durable clips', async () => {
    const folder = await mkdtemp(resolve('.task-tmp/speech-delivery-')), provider = new MockTutor();
    const delivery = new LessonDeliveryStore(folder); await delivery.restore();
    const lessons = tutorPackages(), lesson = lessons[0], record = emptyProgress(lesson);
    await delivery.publish(lessons);
    const tutor = new TutorStore(folder, new ProgressReturnStore(folder, delivery), provider);
      record.queuedQuestions.push({ id: 'speech-question', text: 'Why does a pencil look bent?', askedAt: '2026-10-26T10:00:00Z', timelineStepId: 'step-refraction', answered: false,
        recordedContext: { studentId: record.studentId, lessonId: record.lessonId, recordingId: 'tutor-recording', conceptId: 'refraction', positionMs: 1300 } });
      const submission = await encryptPayload({ enabled: true, progress: record }, '111111');
      await tutor.submit(record.studentId, 'tutor-recording', submission);
      await tutor.idle();
      const complete = await tutor.current(record.studentId, 'tutor-recording');
      expect(complete.replies[0].speechBase64).toBeTruthy();
      const savedPath = join(folder, 'tutor-' + record.studentId + '.json'), before = await readFile(savedPath, 'utf8');
      const projected = deferTutorSpeech(await tutor.current(record.studentId, 'tutor-recording'));
      expect(validTutorState(projected, lesson, record)).toBe(true);
      expect(projected.replies[0].speechBase64).toBeNull();
      expect(projected.replies[0].text).toBe(complete.replies[0].text);
      expect(projected.replies[0].sourceRefs).toEqual(complete.replies[0].sourceRefs);
      expect(await readFile(savedPath, 'utf8')).toBe(before);
      expect((await decryptPayload(await tutor.returned(record.studentId, 'tutor-recording'), '111111') as TutorState).replies[0].speechBase64).toBe(complete.replies[0].speechBase64);
      const ack = await tutor.submit(record.studentId, 'tutor-recording', submission, true); expect(ack.receipt).toBeTruthy();
      expect((await decryptPayload(ack.state, '111111') as TutorState).replies[0].speechBase64).toBeNull();
      const durable = await decryptPayload(JSON.parse(await readFile(savedPath, 'utf8')), '111111') as TutorState;
      expect(durable.replies[0].speechBase64).toBe(complete.replies[0].speechBase64);
  }, 120000);
});
