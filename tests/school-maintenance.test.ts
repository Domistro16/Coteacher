import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyProgress } from "@coteacher/shared";
import { SchoolService, LocalSchoolRepository } from "../delivery/school-store";
import { LocalPrivateStorage } from "../delivery/private-storage";
import { SchoolLessons } from "../delivery/school-lessons";
import { maintainSchool } from "../delivery/school-maintenance";
import { schoolFixture, schoolRecording } from "./school-fixture";
let folder: string;
afterEach(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
});
describe("private object lifecycle", { timeout: 20000 }, () => {
  it("retains consumed upload cleanup records until the signed URL expires", async () => {
    folder = await mkdtemp(join(tmpdir(), "coteacher-upload-cleanup-"));
    const school = new SchoolService(new LocalSchoolRepository(folder));
    const storage = new LocalPrivateStorage(join(folder, "objects"));
    Object.assign(storage, {
      uploadUrl: async () => "https://fictional-storage.invalid/upload",
    });
    const lessons = new SchoolLessons(school, storage);
    const f = await schoolFixture(school);
    const ticket = (await lessons.createUpload(
      f.teacher.id,
      f.offerings[0].id,
      "0".repeat(64),
      3,
    )) as { id: string };
    const upload = await school.repository.transaction((s) => {
      const row = s.uploads.find((u) => u.id === ticket.id)!;
      row.used = true;
      return row;
    });
    await storage.put(upload.objectKey, new Uint8Array([1, 2, 3]));
    expect(
      (await maintainSchool(school.repository, storage)).deletedObjects,
    ).toBe(0);
    expect((await storage.get(upload.objectKey)).length).toBe(3);
    expect(
      (
        await maintainSchool(
          school.repository,
          storage,
          Date.parse(upload.expiresAt) + 1,
        )
      ).deletedObjects,
    ).toBe(1);
    await expect(storage.get(upload.objectKey)).rejects.toThrow();
    expect(await school.repository.transaction((s) => s.uploads)).toHaveLength(
      0,
    );
  });
  it("removes retired versions after their grace period while preserving the active recording and progress", async () => {
    folder = await mkdtemp(join(tmpdir(), "coteacher-maintenance-"));
    const school = new SchoolService(new LocalSchoolRepository(folder)),
      storage = new LocalPrivateStorage(join(folder, "objects")),
      lessons = new SchoolLessons(school, storage);
    const f = await schoolFixture(school);
    const p = await lessons.publish(
      f.teacher.id,
      f.offerings[0].id,
      schoolRecording().lesson,
      false,
      true,
    );
    const personal = await lessons.package(f.student.id, p.id),
      progress = emptyProgress(personal);
    await lessons.progress(f.student.id, p.id, progress);
    const old = await school.repository.transaction(
      (s) => s.learningRecords[0].objectKey,
    );
    progress.events.push({
      eventId: "event-maintenance",
      type: "pause",
      conceptId: "refraction",
      timelineStepId: "step-refraction",
      timestamp: new Date().toISOString(),
    });
    await lessons.progress(f.student.id, p.id, progress);
    expect(
      (await maintainSchool(school.repository, storage)).deletedObjects,
    ).toBe(0);
    expect(
      (
        await maintainSchool(
          school.repository,
          storage,
          Date.now() + 25 * 3600_000,
        )
      ).deletedObjects,
    ).toBe(1);
    await expect(storage.get(old)).rejects.toThrow();
    expect(
      (await lessons.returnedProgress(f.student.id, p.id)).events,
    ).toHaveLength(1);
    expect((await lessons.package(f.student.id, p.id)).title).toBe(
      personal.title,
    );
  });
});
