import { retireSchoolObject } from "./school-maintenance";
import { createHash, randomUUID } from "node:crypto";
import {
  personalizedReplay,
  requirePublishedLesson,
  validateProgressRecord,
  sameProgressEvent,
  sameQuestionIdentity,
  type LessonPackage,
  type ProgressRecord,
} from "@coteacher/shared";
import { SchoolError, type SchoolService } from "./school-store";
import type { PrivateStorage } from "./private-storage";

export const learnerId = (accountId: string) =>
  "student-" +
  createHash("sha256").update(accountId).digest("hex").slice(0, 24);
const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export class SchoolLessons {
  preparedFor?:(actor:string,publicationId:string)=>Promise<import('../packages/shared/src/preparation').PreparedSupport|null>;
  replayFor?:(actor:string)=>Promise<import('@coteacher/shared').ReplayInput|undefined>;
  constructor(
    private school: SchoolService,
    private storage: PrivateStorage,
  ) {}
  async publish(
    actor: string,
    offeringId: string,
    input: unknown,
    external: boolean,
    privacyReviewed: boolean,
    uploadId?: string,
  ) {
    if (!(await this.school.canTeach(actor, offeringId)))
      throw new SchoolError(403, "An active teaching assignment is required.");
    let source = input;
    let upload:
      | { id: string; objectKey: string; sha256: string; byteLength: number }
      | undefined;
    if (uploadId) {
      upload = await this.school.repository.transaction((s) =>
        s.uploads.find(
          (u) =>
            u.id === uploadId &&
            u.teacherId === actor &&
            u.offeringId === offeringId &&
            !u.used &&
            Date.parse(u.expiresAt) > Date.now(),
        ),
      );
      if (!upload)
        throw new SchoolError(
          403,
          "Recording upload is missing, expired or already used.",
        );
      const bytes = await this.storage.get(upload.objectKey, 20_000_000);
      if (bytes.length !== upload.byteLength || digest(bytes) !== upload.sha256)
        throw new SchoolError(
          400,
          "Uploaded recording failed its size or checksum verification.",
        );
      const value = input as LessonPackage;
      if (!value?.recording)
        throw new SchoolError(400, "Reviewed recording metadata required.");
      source = {
        ...value,
        recording: {
          ...value.recording,
          audio: {
            mimeType: value.recording.audio.mimeType,
            sampleRate: value.recording.audio.sampleRate,
            channels: 1,
            mediaKey: value.recording.audio.mediaKey,
            dataBase64: Buffer.from(bytes).toString("base64"),
          },
        },
      };
    }
    const template = requirePublishedLesson(source);
    const recording = template.recording;
    if (
      !recording ||
      recording.audio.mimeType !== "audio/ogg;codecs=opus" ||
      !("dataBase64" in recording.audio) ||
      !template.playback ||
      !privacyReviewed
    )
      throw new SchoolError(
        400,
        "Review complete audio, visuals, privacy and source distribution rights before publishing.",
      );
    const bytes = Buffer.from(recording.audio.dataBase64, "base64");
    if (!bytes.length || bytes.length > 20_000_000)
      throw new SchoolError(400, "Recording exceeds the media budget.");
    const sha256 = digest(bytes),
      lessonId = randomUUID();
    const location = await this.school.repository.transaction((s) => {
      const offering = s.offerings.find(
        (o) => o.id === offeringId && !o.archived,
      )!;
      const subject = s.subjects.find((x) => x.id === offering.subjectId)!;
      if (subject.name.toLowerCase() !== template.subject.toLowerCase())
        throw new SchoolError(
          400,
          `The reviewed lesson is ${template.subject}; choose its matching subject assignment.`,
        );
      return { schoolId: offering.schoolId };
    });
    // Store private objects before making metadata visible. Failed publication never exposes a partial lesson.
    const prefix = `${location.schoolId}/${lessonId}`;
    const metadata = {
      id: lessonId,
      schoolId: location.schoolId,
      offeringId,
      teacherId: actor,
      recordingId: recording.id,
      title: template.title,
      templateKey: prefix + "/template.json",
      audioKey: prefix + "/audio.ogg",
      sha256,
      byteLength: bytes.length,
      publishedAt: new Date().toISOString(),
      archived: false,
    };
    const audio = {
      mimeType: recording.audio.mimeType,
      sampleRate: recording.audio.sampleRate,
      channels: 1,
      mediaKey: recording.audio.mediaKey,
      mediaUrl: `/api/v1/media/${sha256}/${lessonId}`,
      sha256,
      byteLength: bytes.length,
    };
    const stored = requirePublishedLesson({
      ...template,
      recording: { ...recording, audio },
    });
    try {
      await this.storage.put(metadata.audioKey, bytes, "audio/ogg");
      await this.storage.put(
        metadata.templateKey,
        Buffer.from(JSON.stringify(stored)),
        "application/json",
      );
      // Recheck after asynchronous storage: assignment may have been removed while uploading.
      if (!(await this.school.canTeach(actor, offeringId)))
        throw new SchoolError(
          403,
          "Teaching assignment changed before publication.",
        );
      await this.school.repository.transaction((s) => {
        if (!this.school.canTeachInState(s, actor, offeringId))
          throw new SchoolError(403, "Teaching assignment changed.");
        if (upload) {
          const pending = s.uploads.find((u) => u.id === upload!.id && !u.used);
          if (!pending)
            throw new SchoolError(409, "Recording upload was already used.");
          pending.used = true;
        }
        s.lessons.push(metadata);
        s.publications.push({
          id: randomUUID(),
          schoolId: location.schoolId,
          offeringId,
          teacherId: actor,
          recordingId: lessonId,
          reviewed: true,
          external,
        });
        s.audits.push({
          id: randomUUID(),
          actorId: actor,
          schoolId: location.schoolId,
          action: "publish-lesson",
          entityId: lessonId,
          at: metadata.publishedAt,
        });
      });
    } catch (error) {
      // A failed commit can be ambiguous: check durable references before scheduling cleanup.
      await this.school.repository
        .transaction((s) => {
          if (!s.lessons.some((lesson) => lesson.id === lessonId)) {
            retireSchoolObject(s, metadata.audioKey);
            retireSchoolObject(s, metadata.templateKey);
          }
        })
        .catch(() => undefined);
      throw error;
    }
    return { ...metadata, profiles: [], recordingId: recording.id };
  }
  async createUpload(
    actor: string,
    offeringId: string,
    sha256: unknown,
    byteLength: unknown,
  ) {
    if (!(await this.school.canTeach(actor, offeringId)))
      throw new SchoolError(403, "Teaching assignment required.");
    if (
      typeof sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      typeof byteLength !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      byteLength <= 0 ||
      byteLength > 20_000_000
    )
      throw new SchoolError(400, "Valid recording size and checksum required.");
    if (!this.storage.uploadUrl) return { inline: true };
    const upload = await this.school.repository.transaction((s) => {
      const schoolId = s.offerings.find((o) => o.id === offeringId)!.schoolId;
      const id = randomUUID();
      const record = {
        id,
        schoolId,
        teacherId: actor,
        offeringId,
        objectKey: `uploads/${schoolId}/${id}.ogg`,
        sha256,
        byteLength,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        used: false,
      };
      if (
        s.uploads.filter(
          (u) =>
            u.teacherId === actor &&
            !u.used &&
            Date.parse(u.expiresAt) > Date.now(),
        ).length >= 5
      )
        throw new SchoolError(
          429,
          "Finish an existing recording upload before starting another.",
        );
      s.uploads.push(record);
      return record;
    });
    return {
      id: upload.id,
      url: await this.storage.uploadUrl(upload.objectKey, byteLength),
      sha256,
      byteLength,
    };
  }
  async catalog(actor: string) {
    const all = await this.school.repository.transaction((s) =>
      s.lessons.filter((x) => !x.archived),
    );
    const results = [];
    for (const lesson of all)
      if (await this.access(actor, lesson.id))
        results.push({
          id: lesson.id,
          title: lesson.title,
          offeringId: lesson.offeringId,
          schoolId: lesson.schoolId,
          publishedAt: lesson.publishedAt,
        });
    return results;
  }
  async access(actor: string, lessonId: string) {
    const lesson = await this.school.repository.transaction((s) =>
      s.lessons.find((l) => l.id === lessonId && !l.archived),
    );
    if (!lesson) return false;
    if (
      lesson.teacherId === actor &&
      (await this.school.canTeach(actor, lesson.offeringId))
    )
      return true;
    return this.school.canAccessPublication(actor, lesson.id);
  }
  private async authorized(actor: string, lessonId: string) {
    if (!(await this.access(actor, lessonId)))
      throw new SchoolError(
        403,
        "This lesson is not available to this account.",
      );
    return this.school.repository.transaction((s) =>
      s.lessons.find((l) => l.id === lessonId)!,
    );
  }
  async package(actor: string, lessonId: string) {
    const lesson = await this.authorized(actor, lessonId);
    const raw = JSON.parse(
      Buffer.from(await this.storage.get(lesson.templateKey)).toString(),
    );
    const template = requirePublishedLesson(raw);
    const support=await this.preparedFor?.(actor,lessonId);
    const replay=await this.replayFor?.(actor);
    return requirePublishedLesson(
      personalizedReplay(
        { ...template, studentId: learnerId(actor),...(support?{preparedSupport:support as LessonPackage['preparedSupport']}:{}) },
        template.recording!,
        { difficulty: "insufficient-history",...replay },
      ),
    );
  }
  async audio(actor: string, lessonId: string, sha256: string) {
    const lesson = await this.authorized(actor, lessonId);
    if (lesson.sha256 !== sha256)
      throw new SchoolError(404, "Recording not found.");
    const bytes = await this.storage.get(lesson.audioKey);
    if (digest(bytes) !== sha256)
      throw new Error("Stored audio failed its checksum.");
    return bytes;
  }
  async progress(actor: string, lessonId: string, input: unknown) {
    if ((await this.school.snapshot(actor)).account.role !== "student")
      throw new SchoolError(
        403,
        "Only student accounts can submit learning records.",
      );
    const lesson = await this.package(actor, lessonId);
    const valid = validateProgressRecord(input, lesson);
    if (!valid.valid)
      throw new SchoolError(
        400,
        "Progress does not belong to this learner or lesson.",
      );
    const existing = await this.school.repository.transaction((s) =>
      s.learningRecords.find(
        (x) => x.studentId === actor && x.lessonId === lessonId,
      ),
    );
    let record = valid.data;
    if (existing) {
      const previous = JSON.parse(
        Buffer.from(await this.storage.get(existing.objectKey)).toString(),
      ) as ProgressRecord;
      if (
        previous.events.some(
          (event, index) =>
            !record.events[index] ||
            !sameProgressEvent(event, record.events[index]),
        )
      )
        throw new SchoolError(
          409,
          "Existing learning events cannot be removed or changed.",
        );
      for (const question of previous.queuedQuestions) {
        const incoming = record.queuedQuestions.find(
          (q) => q.id === question.id,
        );
        if (!incoming || !sameQuestionIdentity(question, incoming))
          throw new SchoolError(
            409,
            "Existing questions cannot be removed or changed.",
          );
      }
      if (
        record.queuedQuestions.some(
          (q) =>
            q.answered &&
            JSON.stringify(q) !==
              JSON.stringify(
                previous.queuedQuestions.find((x) => x.id === q.id),
              ),
        )
      )
        throw new SchoolError(
          400,
          "Students cannot invent or change teacher answers.",
        );
      record = {
        ...record,
        queuedQuestions: record.queuedQuestions.map((q) => {
          const approved = previous.queuedQuestions.find(
            (x) => x.id === q.id && x.answered,
          );
          return approved ?? q;
        }),
      };
    } else if (record.queuedQuestions.some((q) => q.answered))
      throw new SchoolError(400, "Students cannot submit teacher answers.");
    const submittedDigest = digest(JSON.stringify(valid.data));
    const raw = JSON.stringify(record),
      sha256 = digest(raw);
    const key = `progress/${lessonId}/${actor}/${randomUUID()}-${sha256}.json`;
    await this.storage.put(key, Buffer.from(raw), "application/json");
    await this.school.repository.transaction((s) => {
      const latest = s.learningRecords.find(
        (x) => x.studentId === actor && x.lessonId === lessonId,
      );
      if (latest?.digest === sha256) {
        retireSchoolObject(s, key);
        return;
      }
      if (latest?.digest !== existing?.digest)
        throw new SchoolError(
          409,
          "Progress changed; retry with the latest local history.",
        );
      const schoolId = s.lessons.find((x) => x.id === lessonId)!.schoolId;
      const row = {
        id: existing?.id ?? randomUUID(),
        schoolId,
        studentId: actor,
        lessonId,
        objectKey: key,
        digest: sha256,
        updatedAt: new Date().toISOString(),
      };
      if (latest && latest.objectKey !== key)
        retireSchoolObject(s, latest.objectKey);
      if (latest) Object.assign(latest, row);
      else s.learningRecords.push(row);
    });
    return {
      receipt: {
        schemaVersion: "1.0.0" as const,
        studentId: lesson.studentId,
        lessonId: lesson.lessonId,
        recordingId: lesson.recording!.id,
        sha256: submittedDigest,
        acceptedAt: new Date().toISOString(),
        simulated: true as const,
      },
      received: true,
      sha256: submittedDigest,
      eventIds: valid.data.events.map((e) => e.eventId),
      questionIds: valid.data.queuedQuestions.map((q) => q.id),
    };
  }
  async teacherRecords(actor: string, offeringId: string) {
    if (!(await this.school.canTeach(actor, offeringId)))
      throw new SchoolError(403, "Teaching assignment required.");
    const rows = await this.school.repository.transaction((s) =>
      s.learningRecords.filter((r) =>
        s.lessons.some(
          (l) =>
            l.id === r.lessonId && l.offeringId === offeringId && !l.archived,
        ),
      ),
    );
    return Promise.all(
      rows.map(async (row) => ({
        lessonId: row.lessonId,
        accountId: row.studentId,
        progress: JSON.parse(
          Buffer.from(await this.storage.get(row.objectKey)).toString(),
        ) as ProgressRecord,
      })),
    );
  }
  async returnedProgress(actor: string, lessonId: string) {
    await this.authorized(actor, lessonId);
    const row = await this.school.repository.transaction((s) =>
      s.learningRecords.find(
        (x) => x.studentId === actor && x.lessonId === lessonId,
      ),
    );
    return row
      ? JSON.parse(
          Buffer.from(await this.storage.get(row.objectKey)).toString(),
        )
      : null;
  }
  async answer(
    actor: string,
    lessonId: string,
    studentId: string,
    questionId: string,
    answer: unknown,
    sourceRefs: unknown,
  ) {
    const lesson = await this.school.repository.transaction((s) =>
      s.lessons.find((l) => l.id === lessonId && !l.archived),
    );
    if (!lesson || !(await this.school.canTeach(actor, lesson.offeringId)))
      throw new SchoolError(403, "Teaching assignment required.");
    const row = await this.school.repository.transaction((s) =>
      s.learningRecords.find(
        (r) => r.studentId === studentId && r.lessonId === lessonId,
      ),
    );
    if (!row) throw new SchoolError(404, "Learning record not found.");
    const template = requirePublishedLesson(
      JSON.parse(
        Buffer.from(await this.storage.get(lesson.templateKey)).toString(),
      ),
    );
    const record = JSON.parse(
      Buffer.from(await this.storage.get(row.objectKey)).toString(),
    ) as ProgressRecord;
    const question = record.queuedQuestions.find((q) => q.id === questionId);
    if (!question || question.answered)
      throw new SchoolError(409, "Question is missing or already answered.");
    if (
      typeof answer !== "string" ||
      !answer.trim() ||
      answer.length > 4000 ||
      !Array.isArray(sourceRefs) ||
      !sourceRefs.length ||
      sourceRefs.some(
        (ref) =>
          typeof ref !== "string" ||
          !template.sources.some((s) => s.id === ref),
      )
    )
      throw new SchoolError(
        400,
        "Provide an answer with valid lesson source references.",
      );
    const updated: ProgressRecord = {
      ...record,
      exportedAt: new Date().toISOString(),
      queuedQuestions: record.queuedQuestions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              answered: true,
              answer: answer.trim(),
              sourceRefs: sourceRefs as [string, ...string[]],
              answerOrigin: "teacher-reviewed",
            }
          : q,
      ),
    };
    if (
      !validateProgressRecord(updated, {
        ...template,
        studentId: learnerId(studentId),
        playback: template.playback
          ? { ...template.playback, studentId: learnerId(studentId) }
          : undefined,
      }).valid
    )
      throw new SchoolError(400, "Guidance failed source or context checks.");
    const raw = JSON.stringify(updated),
      sha = digest(raw),
      key = `progress/${lessonId}/${studentId}/${randomUUID()}-${sha}.json`;
    await this.storage.put(key, Buffer.from(raw), "application/json");
    await this.school.repository.transaction((s) => {
      const current = s.learningRecords.find((x) => x.id === row.id);
      if (!current || current.digest !== row.digest)
        throw new SchoolError(
          409,
          "Learning records changed. Refresh before answering.",
        );
      retireSchoolObject(s, current.objectKey);
      current.objectKey = key;
      current.digest = sha;
      current.updatedAt = new Date().toISOString();
      s.audits.push({
        id: randomUUID(),
        actorId: actor,
        schoolId: lesson.schoolId,
        action: "answer-question",
        entityId: questionId,
        at: current.updatedAt,
      });
    });
    return { saved: true };
  }
}
