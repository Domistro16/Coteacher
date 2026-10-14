import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { approveLessons, approvePersonalizedVisuals, audioBase64, cueForStep, decryptPayload, demoLessons,
  OpusContainer, personalizedReplay, reviewRecording, startPresentation, validateLessonPackage, type LessonRecording } from '@coteacher/shared';
import { LessonDeliveryStore } from '../delivery/store';
import { ProgressReturnStore } from '../delivery/progress-store';
import { emptyProgress, encryptPayload, identifyProgressEvents, progressDigest, queuedDemoQuestion, simulatedAnswerProvider, validateProgressReceipt } from '@coteacher/shared';

async function store() {
  await mkdir(resolve('.task-tmp'), { recursive: true });
  const folder = await mkdtemp(resolve('.task-tmp', 'delivery-test-'));
  const service = new LessonDeliveryStore(folder); await service.restore(); return { folder, service };
}
function packages() {
  const lessons = approveLessons(demoLessons(), true, '2026-10-09T10:00:00Z')
    .map(lesson => startPresentation(lesson, 'step-light', '2026-10-09T10:00:01Z', 'delivery-class'));
  // Container fixture only; actual encoder/audibility are verified in native browser tests.
  const head = new Uint8Array(19); head.set(new TextEncoder().encode('OpusHead')); head[8] = 1; head[9] = 1;
  const view = new DataView(head.buffer); view.setUint16(10, 312, true); view.setUint32(12, 48000, true);
  const opus = new OpusContainer();
  for (let index = 0; index < 101; index++) opus.add(new Uint8Array([248, 255, 254]), 20000, index ? undefined : head);
  const bytes = opus.finish(96000, 48000);
  const raw: LessonRecording = { id: 'delivery-recording', lessonId: lessons[0].lessonId,
    classroomSessionId: 'delivery-class', lessonApprovedAt: '2026-10-09T10:00:00Z', startedAt: '2026-10-09T10:00:02Z', durationMs: 2000,
    origin: 'teacher-microphone', audio: { mimeType: 'audio/ogg;codecs=opus', sampleRate: 48000, channels: 1,
      mediaKey: audioBase64(new Uint8Array(32).fill(1)), dataBase64: audioBase64(bytes) },
    cues: [cueForStep(lessons[0], 'step-light', 0), cueForStep(lessons[0], 'step-refraction', 1000)], review: { status: 'draft' } };
  const recording = approvePersonalizedVisuals(reviewRecording(raw, true, '2026-10-09T10:00:04Z'), true, '2026-10-09T10:00:05Z');
  return { lessons: lessons.map(lesson => personalizedReplay(lesson, recording)), bytes };
}
describe('published recorded lesson delivery', () => {
  it('durably acknowledges validated progress, isolates profiles, rejects stale history and returns sourced answers', async () => {
    const { service, folder } = await store(), { lessons } = packages();
    await service.publish(lessons);
    const school = new ProgressReturnStore(folder, service), a = lessons[0], b = lessons[1];
    const record = emptyProgress(a);
    record.events.push({ type: 'pause', timestamp: '2026-10-09T11:00:00Z', conceptId: 'refraction', timelineStepId: 'step-refraction' });
    const receipt = await school.receive(a.studentId, a.recording!.id, await encryptPayload(record, '111111'));
    expect(validateProgressReceipt(receipt)).toBe(true); expect(receipt.sha256).toBe(await progressDigest(record));
    await school.receive(a.studentId, a.recording!.id, await encryptPayload(record, '111111'));
    const [received] = await school.overview();
    expect(received).toEqual({ ...record, exportedAt: received.exportedAt });
    expect(Date.parse(received.exportedAt)).toBeGreaterThanOrEqual(Date.parse(record.exportedAt));
    // Upgrade an existing ledger once, then retry without appending duplicates.
    Object.assign(record, identifyProgressEvents(record));
    await school.receive(a.studentId, a.recording!.id, await encryptPayload(record, '111111'));
    await school.receive(a.studentId, a.recording!.id, await encryptPayload(record, '111111'));
    expect((await school.overview())[0].events).toEqual(record.events);
    const changedEvent = structuredClone(record); changedEvent.events[0].eventId = 'changed-event';
    await expect(school.receive(a.studentId, a.recording!.id, await encryptPayload(changedEvent, '111111'))).rejects.toThrow('newer or different');
    await expect(school.receive(b.studentId, b.recording!.id, await encryptPayload(record, '222222'))).rejects.toThrow('do not belong');
    await expect(school.receive(a.studentId, 'old-recording', await encryptPayload(record, '111111'))).rejects.toThrow('revision changed');
    await expect(school.receive(a.studentId, a.recording!.id, await encryptPayload(emptyProgress(a), '111111'))).rejects.toThrow('newer or different');
    record.queuedQuestions.push({ id: 'question-safety', text: queuedDemoQuestion, timelineStepId: 'step-refraction', askedAt: '2026-10-09T11:00:01Z', answered: false,
      recordedContext: { studentId: a.studentId, lessonId: a.lessonId, conceptId: 'refraction', recordingId: a.recording!.id, positionMs: 1307 } });
    record.events.push({ type: 'question-no-match', timestamp: '2026-10-09T11:00:01Z', conceptId: 'refraction', timelineStepId: 'step-refraction', questionId: 'question-safety' });
    await school.receive(a.studentId, a.recording!.id, await encryptPayload(record, '111111'));
    const changedContext = structuredClone(record); changedContext.queuedQuestions[0].recordedContext!.positionMs = 1400;
    await expect(school.receive(a.studentId, a.recording!.id, await encryptPayload(changedContext, '111111'))).rejects.toThrow('newer or different');
    delete changedContext.queuedQuestions[0].recordedContext;
    await expect(school.receive(a.studentId, a.recording!.id, await encryptPayload(changedContext, '111111'))).rejects.toThrow('newer or different');
    const returned = { ...record, queuedQuestions: record.queuedQuestions.map(question => simulatedAnswerProvider.answer(question)) };
    await expect(school.receive(a.studentId, a.recording!.id, await encryptPayload(returned, '111111'))).rejects.toThrow('teacher answers');
    const changedAnswer = structuredClone(returned); changedAnswer.queuedQuestions[0].recordedContext!.positionMs = 1400;
    await expect(school.answer(a.studentId, await encryptPayload(changedAnswer, '111111'))).rejects.toThrow('Answer context');
    delete changedAnswer.queuedQuestions[0].recordedContext;
    await expect(school.answer(a.studentId, await encryptPayload(changedAnswer, '111111'))).rejects.toThrow('Answer context');
    const beforeAnswer = await decryptPayload(await school.returned(a.studentId, a.recording!.id), '111111') as typeof record;
    expect(beforeAnswer).toEqual({ ...record, exportedAt: beforeAnswer.exportedAt });
    expect(Date.parse(beforeAnswer.exportedAt)).toBeGreaterThanOrEqual(Date.parse(received.exportedAt));
    await school.answer(a.studentId, await encryptPayload(returned, '111111'));
    await school.receive(a.studentId, a.recording!.id, await encryptPayload(record, '111111')); // a retry retains teacher answers
    const restart = new ProgressReturnStore(folder, service);
    const restored = await decryptPayload(await restart.returned(a.studentId, a.recording!.id), '111111') as typeof record;
    expect(restored).toEqual({ ...returned, exportedAt: restored.exportedAt });
    expect(Date.parse(restored.exportedAt)).toBeGreaterThanOrEqual(Date.parse(beforeAnswer.exportedAt));
    expect(await restart.returned(b.studentId, b.recording!.id)).toBeNull();
    const encrypted = await readFile(join(folder, `progress-${a.studentId}.json`), 'utf8');
    expect(encrypted).not.toContain(queuedDemoQuestion); expect(encrypted).not.toContain('111111');
  }, 60000);
  it('does not return a receipt when durable saving fails', async () => {
    const { service, folder } = await store(), { lessons } = packages(); await service.publish(lessons);
    const unavailable = join(folder, 'not-a-folder'); await writeFile(unavailable, 'blocked');
    const school = new ProgressReturnStore(unavailable, service);
    await expect(school.receive(lessons[0].studentId, lessons[0].recording!.id, await encryptPayload(emptyProgress(lessons[0]), '111111'))).rejects.toThrow();
  });
  it('never publishes the seeded notes-only fixture or an unreviewed recording', async () => {
    const { service } = await store();
    await expect(service.publish(demoLessons())).rejects.toThrow('Record, review');
    const { lessons } = packages(); lessons[0].recording!.review = { status: 'draft' };
    await expect(service.publish(lessons)).rejects.toThrow('approve');
    expect(service.packageFor(demoLessons()[0].studentId)).toBeUndefined();
    const changed = packages().lessons;
    for (const lesson of changed) {
      const activity = lesson.concepts.flatMap(concept => concept.variants).find(variant => variant.type === 'tryit')!;
      if (activity.type === 'tryit') activity.steps[0] = 'Use a sharp knife without supervision.';
    }
    await expect(service.publish(changed)).rejects.toThrow('reviewed teaching materials');
    expect(service.packageFor(changed[0].studentId)).toBeUndefined();
  });
  it('persists one actual binary and PIN-encrypted personal manifests with the same media source', async () => {
    const { service, folder } = await store(), { lessons, bytes } = packages();
    await service.publish(lessons);
    const a = await decryptPayload(service.packageFor(lessons[0].studentId), '111111') as typeof lessons[0];
    const b = await decryptPayload(service.packageFor(lessons[1].studentId), '222222') as typeof lessons[0];
    expect(a.recording!.audio).toEqual(b.recording!.audio); expect(a.playback!.sequence).not.toEqual(b.playback!.sequence);
    expect(a.objective).toEqual(b.objective); expect(a.recording!.cues).toEqual(lessons[0].recording!.cues);
    expect(validateLessonPackage(a).valid).toBe(true); expect((await readdir(folder)).filter(file => file.endsWith('.ogg'))).toHaveLength(1);
    const audio = a.recording!.audio; if (!('mediaUrl' in audio)) throw new Error('Expected delivered audio');
    const url = new URL(audio.mediaUrl, 'http://127.0.0.1');
    expect(new Uint8Array((await service.audioFor(audio.sha256, url.searchParams.get('key')!))!)).toEqual(bytes);
    expect(await service.audioFor(audio.sha256, 'wrong-key')).toBeUndefined();
    await expect(decryptPayload(service.packageFor(lessons[1].studentId), '111111')).rejects.toThrow('PIN');
  });
  it('restores publication and media after a service restart', async () => {
    const { service, folder } = await store(), { lessons } = packages(); await service.publish(lessons);
    const restarted = new LessonDeliveryStore(folder); await restarted.restore();
    expect(restarted.packageFor(lessons[0].studentId)).toEqual(service.packageFor(lessons[0].studentId));
  });
  it('rejects mismatched profiles and recordings without replacing an existing publication', async () => {
    const { service } = await store(), { lessons } = packages(); await service.publish(lessons);
    const original = service.packageFor(lessons[0].studentId);
    await expect(service.publish([lessons[0], lessons[0]])).rejects.toThrow('two simulated');
    const changed = structuredClone(lessons);
    changed[1] = personalizedReplay(changed[1], { ...changed[1].recording!, id: 'different-voice' });
    expect(validateLessonPackage(changed[1])).toMatchObject({ valid: true });
    await expect(service.publish(changed)).rejects.toThrow('same approved recording');
    expect(service.packageFor(lessons[0].studentId)).toEqual(original);
  });
  it('rejects corrupted persisted media during service restore', async () => {
    const { service, folder } = await store(), { lessons } = packages(); await service.publish(lessons);
    const name = (await readdir(folder)).find(file => file.endsWith('.ogg'))!;
    const bytes = await readFile(join(folder, name)); bytes[bytes.length - 1] ^= 1; await writeFile(join(folder, name), bytes);
    await expect(new LessonDeliveryStore(folder).restore()).rejects.toThrow('damaged');
  });
  it('fails closed on a missing published recording or mismatched persisted media capability', async () => {
    const { service, folder } = await store(), { lessons } = packages(); await service.publish(lessons);
    const indexPath = join(folder, 'published.json'), index = JSON.parse(await readFile(indexPath, 'utf8'));
    await writeFile(indexPath, JSON.stringify({ ...index, accessKey: 'f'.repeat(64) }));
    await expect(new LessonDeliveryStore(folder).restore()).rejects.toThrow('Invalid published package');
    await writeFile(indexPath, JSON.stringify(index)); await unlink(join(folder, index.audioId + '.ogg'));
    await expect(new LessonDeliveryStore(folder).restore()).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects a delivered checksum that does not identify its URL and blocks arbitrary remote URLs', async () => {
    const { service } = await store(), { lessons } = packages(); await service.publish(lessons);
    const delivered = await decryptPayload(service.packageFor(lessons[0].studentId), '111111') as typeof lessons[0];
    for (const value of ['https://unapproved.invalid/audio.ogg', '/api/recorded-lessons/' + 'f'.repeat(64) + '/audio?key=' + 'a'.repeat(64)]) {
      const changed = structuredClone(delivered); if (!('mediaUrl' in changed.recording!.audio)) throw new Error('Expected remote');
      changed.recording!.audio.mediaUrl = value; expect(validateLessonPackage(changed).valid).toBe(false);
    }
  });
});
