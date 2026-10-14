import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decryptPayload, encryptPayload, profiles, recordingAudioBytes, requirePublishedLesson, type EncryptedTransfer, type LessonPackage } from '@coteacher/shared';

interface Published { audioId: string; accessKey: string; packages: Record<string, EncryptedTransfer> }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** One explicitly published recorded demo; never supplies an invented recording. */
export class LessonDeliveryStore {
  private latest: Published | null = null;
  constructor(private folder: string) {}
  async restore() {
    let stored: Published;
    try { stored = JSON.parse(await readFile(join(this.folder, 'published.json'), 'utf8')) as Published; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    if (!/^[a-f0-9]{64}$/.test(stored.audioId) || !/^[a-f0-9]{64}$/.test(stored.accessKey)) throw new Error('Invalid publication');
    const bytes = await readFile(join(this.folder, stored.audioId + '.ogg'));
    if (hash(bytes) !== stored.audioId) throw new Error('Published recording is damaged');
    for (const profile of profiles) {
      const lesson = requirePublishedLesson(await decryptPayload(stored.packages[profile.id], profile.pin));
      if (lesson.studentId !== profile.id || !lesson.recording || !('mediaUrl' in lesson.recording.audio)
        || lesson.recording.audio.sha256 !== stored.audioId || lesson.recording.audio.byteLength !== bytes.length
        || lesson.recording.audio.mediaUrl !== `/api/recorded-lessons/${stored.audioId}/audio?key=${stored.accessKey}`) throw new Error('Invalid published package');
    }
    this.latest = stored;
  }
  async publish(values: unknown) {
    if (!Array.isArray(values) || values.length !== profiles.length) throw new Error('Publish both prepared learner packages together.');
    const lessons = values.map(value => requirePublishedLesson(value));
    for (const profile of profiles) if (lessons.filter(lesson => lesson.studentId === profile.id).length !== 1) throw new Error('Publish the two simulated profiles only.');
    for (const lesson of lessons) {
      if (!lesson.simulated || lesson.publication.status !== 'approved' || lesson.publication.approvalKind !== 'teacher-review'
        || !lesson.recording || !lesson.playback || lesson.recording.audio.mimeType !== 'audio/ogg;codecs=opus'
        || !('dataBase64' in lesson.recording.audio)) throw new Error('Record, review and approve the complete teacher lesson before publishing.');
    }
    const instruction = (lesson: LessonPackage) => {
      const { studentId, route, playback, visualAssets, ...content } = lesson; return JSON.stringify(content);
    };
    if (lessons.some(lesson => instruction(lesson) !== instruction(lessons[0]))) throw new Error('Both learners must hear the same approved recording and share the original objectives and timeline.');
    const bytes = recordingAudioBytes(lessons[0].recording!);
    const audioId = hash(bytes), accessKey = randomBytes(32).toString('hex');
    const packages: Published['packages'] = {};
    for (const lesson of lessons) {
      const { dataBase64, ...audio } = lesson.recording!.audio as Extract<NonNullable<LessonPackage['recording']>['audio'], { dataBase64: string }>;
      const remote = requirePublishedLesson({ ...lesson, recording: { ...lesson.recording, audio: {
        ...audio, byteLength: bytes.length, sha256: audioId, mediaUrl: `/api/recorded-lessons/${audioId}/audio?key=${accessKey}`,
      } } });
      packages[lesson.studentId] = await encryptPayload(remote, profiles.find(profile => profile.id === lesson.studentId)!.pin);
    }
    await mkdir(this.folder, { recursive: true });
    // The index is committed last; interrupted publication cannot expose half a pair.
    await writeFile(join(this.folder, audioId + '.ogg'), bytes);
    const latest: Published = { audioId, accessKey, packages };
    const temporary = join(this.folder, 'publication-' + randomBytes(8).toString('hex') + '.tmp');
    await writeFile(temporary, JSON.stringify(latest)); await rename(temporary, join(this.folder, 'published.json'));
    this.latest = latest;
    return { recordingId: lessons[0].recording!.id, byteLength: bytes.length, profiles: lessons.map(lesson => lesson.studentId) };
  }
  packageFor(id: string) { return this.latest?.packages[id]; }
  async publicationInfo() {
    const value = this.packageFor(profiles[0].id);
    if (!value) return null;
    const lesson = await decryptPayload(value, profiles[0].pin) as LessonPackage;
    return { recordingId: lesson.recording!.id, lessonApprovedAt: lesson.recording!.lessonApprovedAt };
  }
  async audioFor(id: string, accessKey: string) {
    if (!this.latest || id !== this.latest.audioId || accessKey !== this.latest.accessKey) return undefined;
    const bytes = await readFile(join(this.folder, id + '.ogg'));
    if (hash(bytes) !== id) throw new Error('Published recording is damaged');
    return bytes;
  }
}
