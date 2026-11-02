import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyProgress, type TutorState } from "@coteacher/shared";
import { SchoolService, LocalSchoolRepository } from "../delivery/school-store";
import { LocalPrivateStorage } from "../delivery/private-storage";
import { SchoolLessons } from "../delivery/school-lessons";
import { SchoolTutor } from "../delivery/school-tutor";
import { schoolFixture, schoolRecording } from "./school-fixture";
import { MockTutor } from "./tutor-fixture";
import { LearnerService } from '../delivery/learner-service';

describe(
  "identity-scoped school tutoring (mock provider)",
  { timeout: 30000 },
  () => {
    let folder: string;
    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "coteacher-school-tutor-"));
    });
    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });
    it('projects permitted preferences only and discards results when authorization is withdrawn during generation',async()=>{
      const school=new SchoolService(new LocalSchoolRepository(folder)),storage=new LocalPrivateStorage(join(folder,'private')),lessons=new SchoolLessons(school,storage),provider=new MockTutor();
      const f=await schoolFixture(school),secret='fictional-school-server-secret-12345',learners=new LearnerService(school,secret);
      await learners.update(f.student.id,{revision:0,ageBand:'adult',permissions:{essential:true,personalization:true,externalAI:true},answers:{preferredName:'PRIVATE-NAME',comfort:1,studyTime:'evening',interests:['football'],confidence:[{subject:'Science',rating:2}]}});
      const publication=await lessons.publish(f.teacher.id,f.offerings[0].id,schoolRecording().lesson,false,true),lesson=await lessons.package(f.student.id,publication.id),progress=emptyProgress(lesson);
      progress.queuedQuestions.push({id:'withdraw-generation',text:'Why does light change direction?',askedAt:new Date().toISOString(),answered:false,timelineStepId:'step-refraction',recordedContext:{studentId:lesson.studentId,lessonId:lesson.lessonId,conceptId:'refraction',recordingId:lesson.recording!.id,positionMs:1300}});
      let release!:()=>void;const waiting=new Promise<void>(r=>{release=r;});let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
      const original=provider.answer.bind(provider);provider.answer=async input=>{entered();await waiting;return original(input);};
      const tutor=new SchoolTutor(school,lessons,storage,secret,provider,undefined,learners);
      await tutor.request(f.student.id,publication.id,'submit',{enabled:true,progress});await started;
      await learners.withdraw(f.student.id);release();await tutor.idle();
      expect(provider.inputs[0].teachingPreferences?.interests).toEqual(['football']);
      expect(provider.inputs[0].teachingPreferences?.confidence).toBe(2);
      const payload=JSON.stringify(provider.inputs[0]);for(const text of ['PRIVATE-NAME','comfort','guardianEmail','studyTime'])expect(payload).not.toContain(text);
      const state=await tutor.request(f.student.id,publication.id,'current') as TutorState;
      expect(state.replies[0].status).not.toBe('answered');expect(state.replies[0].citations).toEqual([]);
      expect(JSON.stringify(await tutor.overview(f.teacher.id,f.offerings[0].id))).not.toContain('PRIVATE-NAME');
      await expect(tutor.request(f.student.id,publication.id,'submit',{enabled:true,progress})).rejects.toThrow('authorization');
    });
    it("keeps the sourced tutor, voice and teacher oversight behind enrollment and explicit consent", async () => {
      const school = new SchoolService(new LocalSchoolRepository(folder)),
        storage = new LocalPrivateStorage(join(folder, "private")),
        lessons = new SchoolLessons(school, storage),
        provider = new MockTutor();
      const f = await schoolFixture(school);
      const published = await lessons.publish(
        f.teacher.id,
        f.offerings[0].id,
        schoolRecording().lesson,
        false,
        true,
      );
      const personal = await lessons.package(f.student.id, published.id);
      const progress = emptyProgress(personal);
      progress.queuedQuestions.push({
        id: "question-school",
        text: "Why does light change direction at a boundary?",
        askedAt: new Date().toISOString(),
        answered: false,
        timelineStepId: "step-refraction",
        recordedContext: {
          studentId: personal.studentId,
          lessonId: personal.lessonId,
          conceptId: "refraction",
          recordingId: personal.recording!.id,
          positionMs: 1300,
        },
      });
      const tutor = new SchoolTutor(
        school,
        lessons,
        storage,
        "fictional-school-server-secret-12345",
        provider,
      );
      await expect(
        tutor.request(f.outsider.id, published.id, "submit", {
          enabled: true,
          progress,
        }),
      ).rejects.toThrow("authorized student");
      await expect(
        tutor.request(f.student.id, published.id, "voice", {
          enabled: true,
          audioBase64: "AAAA",
          mime: "audio/webm",
        }),
      ).rejects.toThrow("Enable connected");
      await tutor.request(f.student.id, published.id, "submit", {
        enabled: true,
        progress,
      });
      await tutor.idle();
      const state = (await tutor.request(
        f.student.id,
        published.id,
        "current",
      )) as TutorState;
      expect(state.replies[0].status).toBe("answered");
      expect(state.replies[0].sourceRefs.length).toBeGreaterThan(0);
      expect(provider.inputs).toHaveLength(1);
      const stored = await school.repository.transaction(
        (s) => s.tutorRecords[0],
      );
      expect(
        Buffer.from(await storage.get(stored.objectKey)).includes(
          Buffer.from(progress.queuedQuestions[0].text),
        ),
      ).toBe(false);
      expect(
        await tutor.request(f.student.id, published.id, "voice", {
          enabled: true,
          audioBase64: Buffer.from("synthetic voice").toString("base64"),
          mime: "audio/webm",
        }),
      ).toEqual({
        text: "Why does light change direction when it enters water?",
      });
      const overview = await tutor.overview(f.teacher.id, f.offerings[0].id);
      expect(overview.states[0].studentId).toBe(personal.studentId);
      await expect(
        tutor.overview(f.outsider.id, f.offerings[0].id),
      ).rejects.toThrow("assignment");
      await tutor.overview(f.teacher.id, f.offerings[0].id, {
        studentId: f.student.id,
        lessonId: published.id,
        questionId: "question-school",
      });
      expect(
        (
          (await tutor.request(
            f.student.id,
            published.id,
            "current",
          )) as TutorState
        ).replies[0].review,
      ).toBe("flagged");
      const restarted = new SchoolTutor(
        school,
        lessons,
        storage,
        "fictional-school-server-secret-12345",
        provider,
      );
      expect(
        (
          (await restarted.request(
            f.student.id,
            published.id,
            "current",
          )) as TutorState
        ).replies[0].review,
      ).toBe("flagged");
      await restarted.idle();
      await tutor.request(f.student.id, published.id, "consent", {
        enabled: false,
      });
      expect(
        (
          (await tutor.request(
            f.student.id,
            published.id,
            "current",
          )) as TutorState
        ).enabled,
      ).toBe(false);
      expect(
        await school.repository.transaction((s) =>
          s.consents.some(
            (c) =>
              c.accountId === f.student.id &&
              c.kind === "external-ai" &&
              !c.withdrawn,
          ),
        ),
      ).toBe(false);
      await expect(
        tutor.request(f.student.id, published.id, "voice", {
          enabled: true,
          audioBase64: "AAAA",
          mime: "audio/webm",
        }),
      ).rejects.toThrow("Enable connected");
    });
  },
);
