import { retireSchoolObject } from "./school-maintenance";
import { sealServer, openServer } from "./server-encryption";
import { createHmac, createHash, randomUUID } from "node:crypto";
import {
  deferTutorSpeech,
  personalizedReplay,
  requirePublishedLesson,
  type ProgressRecord,
} from "@coteacher/shared";
import { TutorStore } from "./tutor-store";
import type { TutorProvider } from "./tutor-provider";
import type { LiveVoiceProvider } from "./live-provider";
import { SchoolError, type SchoolService } from "./school-store";
import { learnerId, type SchoolLessons } from "./school-lessons";
import type { PrivateStorage } from "./private-storage";
import type { LearnerService } from './learner-service';

/** Identity-authorized JSON transport reuses the existing sourced tutor worker.
 * Device PINs never leave the browser; durable tutor state uses a separate server key.
 */
export class SchoolTutor {
  private workers = new Map<string, TutorStore>();
  constructor(
    private school: SchoolService,
    private lessons: SchoolLessons,
    private storage: PrivateStorage,
    private secret: string,
    readonly provider?: TutorProvider,
    private live?: LiveVoiceProvider,
    private learners?: LearnerService,
  ) {
    if (secret.length < 32)
      throw new Error("A stable server tutor-storage key is required.");
  }
  get liveAvailable() {
    return !!this.live;
  }
  private get consentKind(){return this.provider?.engine==='llama.cpp'?'local-ai' as const:'external-ai' as const;}
  private key(actor: string, lessonId: string) {
    return createHmac("sha256", this.secret)
      .update(actor + ":" + lessonId)
      .digest();
  }
  private seal(actor: string, lessonId: string, value: unknown) {
    return sealServer(value, this.key(actor, lessonId), actor + ":" + lessonId);
  }
  private open(actor: string, lessonId: string, value: unknown) {
    return openServer(value, this.key(actor, lessonId), actor + ":" + lessonId);
  }
  private worker(actor: string, lessonId: string) {
    const cacheKey = actor + ":" + lessonId;
    const existing = this.workers.get(cacheKey);
    if (existing) return existing;
    if (this.workers.size >= 4096)
      throw new SchoolError(
        429,
        "The tutoring worker is busy. Your question stays saved.",
      );
    const id = learnerId(actor);
    const progress = {
      lesson: async (studentId: string, recordingId?: string) => {
        if (studentId !== id)
          throw new SchoolError(403, "Learner identity mismatch.");
        const lesson = await this.lessons.package(actor, lessonId);
        if (recordingId && lesson.recording?.id !== recordingId)
          throw new SchoolError(409, "Recording revision changed.");
        return lesson;
      },
      received: async () =>
        (await this.lessons.returnedProgress(
          actor,
          lessonId,
        )) as ProgressRecord | null,
      receive: async (
        studentId: string,
        _recordingId: string,
        envelope: unknown,
      ) => {
        if (studentId !== id)
          throw new SchoolError(403, "Learner identity mismatch.");
        return (
          await this.lessons.progress(
            actor,
            lessonId,
            this.open(actor, lessonId, envelope),
          )
        ).receipt;
      },
      overview: async () => {
        const record = (await this.lessons.returnedProgress(
          actor,
          lessonId,
        )) as ProgressRecord | null;
        return record ? [record] : [];
      },
    };
    const persistence = {
      read: async () => {
        const row = await this.school.repository.transaction((s) =>
          s.tutorRecords.find(
            (r) => r.studentId === actor && r.lessonId === lessonId,
          ),
        );
        return row
          ? JSON.parse(
              Buffer.from(await this.storage.get(row.objectKey)).toString(),
            )
          : null;
      },
      write: async (_id: string, envelope: unknown) => {
        const raw = JSON.stringify(envelope);
        if (raw.length > 48_000_000)
          throw new SchoolError(413, "Saved tutoring exceeds its budget.");
        const hash = createHash("sha256").update(raw).digest("hex"),
          key = `tutoring/${lessonId}/${actor}/${randomUUID()}-${hash}.json`;
        await this.storage.put(key, Buffer.from(raw), "application/json");
        await this.school.repository.transaction((s) => {
          const lesson = s.lessons.find((l) => l.id === lessonId);
          if (!lesson) throw new SchoolError(404, "Lesson not found.");
          const row = s.tutorRecords.find(
            (r) => r.studentId === actor && r.lessonId === lessonId,
          );
          const next = {
            id: row?.id ?? randomUUID(),
            schoolId: lesson.schoolId,
            lessonId,
            studentId: actor,
            objectKey: key,
            updatedAt: new Date().toISOString(),
          };
          if (row) {
            retireSchoolObject(s, row.objectKey);
            Object.assign(row, next);
          } else s.tutorRecords.push(next);
        });
      },
    };
    const worker = new TutorStore("", progress, this.provider, {
      beforeProvider: async () => {
        if (
          (this.learners && !(await this.learners.externalAllowed(actor,this.consentKind==='external-ai'))) ||
          !(await this.lessons.access(actor, lessonId)) ||
          !(await this.school.repository.transaction((s) =>
            s.consents.some(
              (c) =>
                c.accountId === actor &&
                c.kind === this.consentKind &&
                !c.withdrawn,
            ),
          ))
        )
          throw new SchoolError(
            403,
            "School access or connected tutoring permission changed.",
          );
      },
      providerInput:async input=>({...input,teachingPreferences:await this.learners?.providerPreferences(actor,input.subject??'Science',this.consentKind==='external-ai')}),
      crypto: {
        seal: async (studentId, value) => {
          if (studentId !== id)
            throw new SchoolError(403, "Learner identity mismatch.");
          return this.seal(actor, lessonId, value);
        },
        open: async (studentId, value) => {
          if (studentId !== id)
            throw new SchoolError(403, "Learner identity mismatch.");
          return this.open(actor, lessonId, value);
        },
      },
      persistence,
    });
    this.workers.set(cacheKey, worker);
    return worker;
  }
  async request(
    actor: string,
    lessonId: string,
    operation: string,
    data?: Record<string, unknown>,
    deferSpeech = false,
  ) {
    const snapshot = await this.school.snapshot(actor);
    if (
      snapshot.account.role !== "student" ||
      !(await this.lessons.access(actor, lessonId))
    )
      throw new SchoolError(403, "An authorized student lesson is required.");
    const lesson = await this.lessons.package(actor, lessonId),
      id = learnerId(actor),
      recordingId = lesson.recording!.id,
      worker = this.worker(actor, lessonId);
    if (operation === "submit" && typeof data?.enabled === "boolean") {
      const consent = await this.school.repository.transaction((s) =>
        s.consents.some(
          (c) =>
            c.accountId === actor && c.kind === this.consentKind && !c.withdrawn,
        ),
      );
      if (data.enabled !== consent)
        await this.school.command(actor, "consent", {
          kind: this.consentKind,
          accepted: data.enabled,
        });
    }
    if (operation === "consent")
      await this.school.command(actor, "consent", {
        kind: this.consentKind,
        accepted: false,
      });
    const permitted = await this.school.repository.transaction((s) =>
      s.consents.some(
        (c) =>
          c.accountId === actor && c.kind === this.consentKind && !c.withdrawn,
      ),
    );
    const ready = !this.learners || await this.learners.externalAllowed(actor,this.consentKind==='external-ai');
    if (!['current','consent'].includes(operation) && !ready)throw new SchoolError(403,'Complete verified authorization and external AI permission in My learning preferences first. Prepared lessons remain available.');
    if (!["current", "consent"].includes(operation) && !permitted)
      throw new SchoolError(
        403,
        "Enable connected tutoring before sending a question.",
      );
    const envelope = data ? this.seal(actor, lessonId, data) : undefined;
    if (operation === "current") {
      if ((!permitted || !ready) && (await this.lessons.returnedProgress(actor, lessonId)))
        await worker.disable(
          id,
          recordingId,
          this.seal(actor, lessonId, { enabled: false }),
        );
      const current = await worker.current(id, recordingId);
      return deferSpeech ? deferTutorSpeech(current) : current;
    }
    if (operation === "submit") {
      const value = await worker.submit(id, recordingId, envelope, deferSpeech);
      return {
        receipt: value.receipt,
        state: this.open(actor, lessonId, value.state),
      };
    }
    if (
      operation === "consent" &&
      !(await this.lessons.returnedProgress(actor, lessonId))
    )
      return { saved: true };
    if (operation === "consent")
      return worker.disable(
        id,
        recordingId,
        this.seal(actor, lessonId, { enabled: false }),
      );
    if (operation === "check")
      return this.open(
        actor,
        lessonId,
        await worker.check(id, recordingId, envelope),
      );
    if (operation === "voice")
      return this.open(
        actor,
        lessonId,
        await worker.transcribe(id, recordingId, envelope),
      );
    if (operation === "live")
      return this.open(
        actor,
        lessonId,
        await worker.live(id, recordingId, envelope, this.live),
      );
    throw new SchoolError(404, "Unknown tutoring operation.");
  }
  async overview(
    actor: string,
    offeringId: string,
    flag?: { studentId: string; lessonId: string; questionId: string },
  ) {
    if (!(await this.school.canTeach(actor, offeringId)))
      throw new SchoolError(403, "Teaching assignment required.");
    const records = await this.lessons.teacherRecords(actor, offeringId),
      states = [];
    for (const row of records) {
      if (
        flag &&
        (row.accountId !== flag.studentId || row.lessonId !== flag.lessonId)
      )
        continue;
      const meta = await this.school.repository.transaction((s) =>
        s.lessons.find((l) => l.id === row.lessonId)!,
      );
      const template = requirePublishedLesson(
        JSON.parse(
          Buffer.from(await this.storage.get(meta.templateKey)).toString(),
        ),
      );
      const lesson = personalizedReplay(
        { ...template, studentId: learnerId(row.accountId) },
        template.recording!,
        { difficulty: "insufficient-history" },
      );
      const state = await this.worker(row.accountId, row.lessonId).reviewState(
        lesson.studentId,
        lesson,
        row.progress,
        flag?.questionId,
      );
      states.push({
        ...state,
        schoolLessonId: row.lessonId,
        accountId: row.accountId,
      });
    }
    if (flag && !states.length)
      throw new SchoolError(404, "Received tutoring record not found.");
    return { states, provider: this.provider?.engine ?? "unavailable" };
  }
  async idle() {
    await Promise.all([...this.workers.values()].map((w) => w.idle()));
  }
}
