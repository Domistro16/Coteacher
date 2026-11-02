import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  emptyProgress,
  identifyProgressEvents,
  progressDigest,
  validateProgressReceipt,
  type ProgressRecord,
} from "@coteacher/shared";
import { SchoolService, LocalSchoolRepository } from "../delivery/school-store";
import {
  EncryptedPrivateStorage,
  LocalPrivateStorage,
} from "../delivery/private-storage";
import { SchoolLessons, learnerId } from "../delivery/school-lessons";
import { schoolFixture, schoolRecording } from "./school-fixture";
describe(
  "school-authorized recording distribution and learning return",
  { timeout: 20000 },
  () => {
    let folder: string;
    let school: SchoolService;
    let lessons: SchoolLessons;
    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "coteacher-school-lessons-"));
      school = new SchoolService(new LocalSchoolRepository(folder));
      lessons = new SchoolLessons(
        school,
        new LocalPrivateStorage(join(folder, "private")),
      );
    });
    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });
    it("publishes only for an assigned teacher and delivers separate source-checked learner packages", async () => {
      const f = await schoolFixture(school);
      const { lesson, bytes } = schoolRecording();
      await expect(
        lessons.publish(f.outsider.id, f.offerings[0].id, lesson, false, true),
      ).rejects.toThrow("assignment");
      await expect(
        lessons.publish(f.teacher.id, f.offerings[0].id, lesson, false, false),
      ).rejects.toThrow("Review");
      const published = await lessons.publish(
        f.teacher.id,
        f.offerings[0].id,
        lesson,
        false,
        true,
      );
      expect((await lessons.catalog(f.student.id)).map((x) => x.id)).toContain(
        published.id,
      );
      expect(await lessons.catalog(f.outsider.id)).toEqual([]);
      const personal = await lessons.package(f.student.id, published.id);
      expect(personal.studentId).toBe(learnerId(f.student.id));
      expect(personal.objective).toEqual(lesson.objective);
      expect(
        Buffer.from(
          await lessons.audio(f.student.id, published.id, published.sha256),
        ),
      ).toEqual(Buffer.from(bytes));
      await expect(
        lessons.audio(f.outsider.id, published.id, published.sha256),
      ).rejects.toThrow("not available");
      await expect(
        lessons.audio(f.student.id, published.id, "0".repeat(64)),
      ).rejects.toThrow("not found");
    });
    it("honors teacher-only external sharing and withdraws delivery on membership removal", async () => {
      const f = await schoolFixture(school);
      const { lesson } = schoolRecording();
      const p = await lessons.publish(
        f.teacher.id,
        f.offerings[0].id,
        lesson,
        true,
        true,
      );
      const outside = await lessons.package(f.outsider.id, p.id);
      expect(outside.studentId).not.toBe(
        (await lessons.package(f.student.id, p.id)).studentId,
      );
      await school.command(f.teacher.id, "publication-audience", {
        schoolId: f.school.id,
        offeringId: f.offerings[0].id,
        recordingId: p.id,
        external: false,
        reviewed: true,
      });
      await expect(lessons.package(f.outsider.id, p.id)).rejects.toThrow(
        "not available",
      );
      const m = (await school.snapshot(f.owner.id)).memberships.find(
        (m) => m.accountId === f.teacher.id,
      )!;
      await school.command(f.owner.id, "membership", {
        schoolId: f.school.id,
        id: m.id,
        status: "ended",
      });
      await expect(lessons.package(f.student.id, p.id)).rejects.toThrow(
        "not available",
      );
    });
    it("acknowledges durable append-only progress, returns sourced teacher guidance and rejects tampering", async () => {
      const f = await schoolFixture(school);
      const { lesson } = schoolRecording();
      const p = await lessons.publish(
        f.teacher.id,
        f.offerings[0].id,
        lesson,
        false,
        true,
      );
      const personal = await lessons.package(f.student.id, p.id);
      const progress = identifyProgressEvents(emptyProgress(personal));
      progress.events.push({
        eventId: "event-fictional",
        type: "pause",
        timestamp: new Date().toISOString(),
        conceptId: "refraction",
        timelineStepId: "step-refraction",
      });
      progress.queuedQuestions.push({
        id: "question-fictional",
        text: "Why does the pencil look bent?",
        timelineStepId: "step-refraction",
        askedAt: new Date().toISOString(),
        answered: false,
      });
      const received = await lessons.progress(f.student.id, p.id, progress);
      expect(validateProgressReceipt(received.receipt)).toBe(true);
      expect(received.receipt.sha256).toBe(await progressDigest(progress));
      await lessons.progress(f.student.id, p.id, progress);
      expect(
        await lessons.teacherRecords(f.teacher.id, f.offerings[0].id),
      ).toHaveLength(1);
      const changed = structuredClone(progress);
      changed.events = [];
      await expect(
        lessons.progress(f.student.id, p.id, changed),
      ).rejects.toThrow("cannot be removed");
      await expect(
        lessons.answer(
          f.outsider.id,
          p.id,
          f.student.id,
          "question-fictional",
          "Invented",
          ["notes-light"],
        ),
      ).rejects.toThrow("assignment");
      await expect(
        lessons.answer(
          f.teacher.id,
          p.id,
          f.student.id,
          "question-fictional",
          "A response",
          ["invented-source"],
        ),
      ).rejects.toThrow("source");
      await lessons.answer(
        f.teacher.id,
        p.id,
        f.student.id,
        "question-fictional",
        "Light changes direction at the boundary.",
        ["notes-light"],
      );
      const returned = (await lessons.returnedProgress(
        f.student.id,
        p.id,
      )) as ProgressRecord;
      expect(returned.queuedQuestions[0].answered).toBe(true);
      await lessons.progress(f.student.id, p.id, progress);
      expect(
        ((await lessons.returnedProgress(f.student.id, p.id)) as ProgressRecord)
          .queuedQuestions[0].answered,
      ).toBe(true);
      const forged = structuredClone(returned);
      if (forged.queuedQuestions[0].answered)
        forged.queuedQuestions[0].answer = "Changed answer";
      await expect(
        lessons.progress(f.student.id, p.id, forged),
      ).rejects.toThrow("cannot invent");
      await expect(
        lessons.progress(f.outsider.id, p.id, progress),
      ).rejects.toThrow("not available");
    });
    it("publishes a signed raw upload as encrypted private objects and consumes the ticket once", async () => {
      const f = await schoolFixture(school);
      const storage = new LocalPrivateStorage(join(folder, "private"));
      Object.assign(storage, {
        uploadUrl: async (key: string) =>
          "https://storage.example.invalid/" + key,
      });
      lessons = new SchoolLessons(
        school,
        new EncryptedPrivateStorage(
          storage,
          "fictional-server-storage-secret-12345",
        ),
      );
      const { lesson, bytes } = schoolRecording();
      const sha = createHash("sha256").update(bytes).digest("hex");
      const ticket = (await lessons.createUpload(
        f.teacher.id,
        f.offerings[0].id,
        sha,
        bytes.length,
      )) as { id: string; url: string };
      expect(ticket.url).toContain("https://storage.example.invalid/");
      const row = await school.repository.transaction((s) =>
        s.uploads.find((u) => u.id === ticket.id)!,
      );
      await storage.put(row.objectKey, bytes);
      // A browser PUT stores raw temporary audio; publication receives remote metadata.
      const uploadedLesson = structuredClone(lesson);
      const audio = uploadedLesson.recording!.audio;
      uploadedLesson.recording!.audio = {
        mimeType: audio.mimeType,
        sampleRate: audio.sampleRate,
        channels: audio.channels,
        mediaKey: audio.mediaKey!,
        mediaUrl: `/api/v1/media/${sha}/${ticket.id}`,
        sha256: sha,
        byteLength: bytes.length,
      };
      const p = await lessons.publish(
        f.teacher.id,
        f.offerings[0].id,
        uploadedLesson,
        false,
        true,
        ticket.id,
      );
      expect(p.byteLength).toBe(bytes.length);
      for (const key of [p.audioKey, p.templateKey]) {
        const raw = Buffer.from(await storage.get(key));
        expect(raw.subarray(0, 4).toString()).toBe("COT2");
      }
      const personal = await lessons.package(f.student.id, p.id);
      expect(personal.studentId).toBe(learnerId(f.student.id));
      expect(personal.recording!.audio).toMatchObject({
        sha256: sha,
        byteLength: bytes.length,
      });
      expect(
        Buffer.from(await lessons.audio(f.student.id, p.id, sha)),
      ).toEqual(Buffer.from(bytes));
      await expect(
        lessons.publish(
          f.teacher.id,
          f.offerings[0].id,
          lesson,
          false,
          true,
          ticket.id,
        ),
      ).rejects.toThrow("expired or already used");
    });
    it("does not publish after authority changes during storage and schedules partial files for cleanup", async () => {
      const f = await schoolFixture(school);
      const storage = new LocalPrivateStorage(join(folder, "private"));
      const originalPut = storage.put.bind(storage);
      storage.put = async (key, bytes) => {
        await originalPut(key, bytes);
        if (key.endsWith("template.json"))
          await school.repository.transaction((s) => {
            s.schools[0].status = "suspended";
          });
      };
      const publishing = new SchoolLessons(school, storage);
      await expect(
        publishing.publish(
          f.teacher.id,
          f.offerings[0].id,
          schoolRecording().lesson,
          false,
          true,
        ),
      ).rejects.toThrow("assignment changed");
      await school.repository.transaction((s) => {
        expect(s.lessons).toHaveLength(0);
        expect(s.retiredObjects).toHaveLength(2);
      });
    });
  },
);
