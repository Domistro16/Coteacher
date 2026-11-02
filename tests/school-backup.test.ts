import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupSchool, restoreSchool } from "../delivery/school-backup";
import { LocalSchoolRepository, SchoolService } from "../delivery/school-store";
import { LocalPrivateStorage } from "../delivery/private-storage";
import { SchoolLessons } from "../delivery/school-lessons";
import { schoolFixture, schoolRecording } from "./school-fixture";
import { LearnerService } from '../delivery/learner-service';
import {improvementDataNoticeVersion} from '../packages/shared/src/improvement-data';
import {sealServer} from '../delivery/server-encryption';
import {createHash} from 'node:crypto';
describe("encrypted school backup and restoration", { timeout: 20000 }, () => {
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "coteacher-backup-"));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });
  it("restores metadata and private recordings into an empty destination and revokes local sessions", async () => {
    const school = new SchoolService(
        new LocalSchoolRepository(join(folder, "source")),
      ),
      storage = new LocalPrivateStorage(join(folder, "objects")),
      lessons = new SchoolLessons(school, storage);
    const f = await schoolFixture(school);
    const learnerSecret='fictional-stable-backup-profile-key-123';
    await new LearnerService(school,learnerSecret).update(f.student.id,{revision:0,ageBand:'adult',permissions:{essential:true,personalization:true,externalAI:false,improvementData:true},improvementNoticeVersion:improvementDataNoticeVersion,answers:{interests:['football']}});
    await school.repository.transaction(s=>{s.privateLearners[0].improvementFeaturesEnvelope=sealServer({schoolId:f.school.id,counts:[1]},createHash('sha256').update('learner-profile-v1:'+learnerSecret).digest(),'learner-improvement-features-v1:'+f.student.id);});
    const p = await lessons.publish(
      f.teacher.id,
      f.offerings[0].id,
      schoolRecording().lesson,
      false,
      true,
    );
    await school.login(f.teacher.email, "fictional-password-123");
    const backup = join(folder, "backup"),
      key = "a".repeat(64);
    expect(
      (await backupSchool(school.repository, storage, backup, key)).objects,
    ).toBe(2);
    expect(
      (await readFile(join(backup, "manifest.bin"))).includes(
        Buffer.from(f.teacher.email),
      ),
    ).toBe(false);
    const destination = new LocalSchoolRepository(join(folder, "destination")),
      destinationObjects = new LocalPrivateStorage(
        join(folder, "destination-objects"),
      );
    await expect(
      restoreSchool(destination, destinationObjects, backup, "b".repeat(64)),
    ).rejects.toThrow();
    await restoreSchool(destination, destinationObjects, backup, key);
    const restored = new SchoolService(destination);
    const learner=new LearnerService(restored,learnerSecret),profile=await learner.get(f.student.id);
    expect(profile.answers.interests).toEqual(['football']);expect(profile.personalizationAllowed).toBe(true);expect(profile.improvementDataAllowed).toBe(false);
    const privateRow=await destination.transaction(s=>s.privateLearners[0]);expect(privateRow.improvementExcludedAt).toBeTruthy();expect(privateRow.improvementFeaturesEnvelope).toBeUndefined();expect(privateRow.improvementAuthorizationRequestId).toBeUndefined();
    await expect(learner.update(f.student.id,{revision:profile.revision,permissions:{...profile.permissions,improvementData:true}})).rejects.toThrow('notice');
    expect((await destination.transaction((s) => s.loginSessions)).length).toBe(
      0,
    );
    expect(
      (
        await new SchoolLessons(restored, destinationObjects).package(
          f.student.id,
          p.id,
        )
      ).title,
    ).toBe(schoolRecording().lesson.title);
    await expect(
      restoreSchool(destination, destinationObjects, backup, key),
    ).rejects.toThrow("empty target");
  });
});
