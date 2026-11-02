import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalSchoolRepository, SchoolService } from "../delivery/school-store";

describe(
  "school registration and subject enrollment",
  { timeout: 20000 },
  () => {
    let folder: string;
    let service: SchoolService;
    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "coteacher-school-"));
      service = new SchoolService(new LocalSchoolRepository(folder));
    });
    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });
    async function user(role: string, email = `${role}@fictional.invalid`) {
      return service.register({
        name: `Fictional ${role}`,
        email,
        role,
        password: "fictional-password-123",
        simulated: true,
      });
    }
    async function setup() {
      const owner = await user("owner");
      const teacher = await user("teacher");
      const student = await user("student");
      const school = (await service.command(owner.id, "register-school", {
        name: "Simulated school",
        location: "Fictional location",
        contact: "fictional.invalid",
        evidence: "Simulated evidence",
        levels: ["JSS1", "SS1"],
      })) as { id: string };
      await service.repository.transaction((s) => {
        s.schools[0].status = "active";
      });
      for (const a of [teacher, student]) {
        await service.command(a.id, "request-join", { schoolId: school.id });
        const membership = (await service.snapshot(owner.id)).memberships.find(
          (m) => m.accountId === a.id,
        )!;
        await service.command(owner.id, "membership", {
          schoolId: school.id,
          id: membership.id,
          status: "active",
        });
      }
      await service.command(owner.id, "session", {
        schoolId: school.id,
        name: "2026/2027",
      });
      const sessionId = (await service.snapshot(owner.id)).sessions[0].id;
      await service.command(owner.id, "group", {
        schoolId: school.id,
        sessionId,
        level: "JSS1",
        name: "JSS1A",
        min: 2,
        max: 2,
      });
      const groupId = (await service.snapshot(owner.id)).groups[0].id;
      for (const [name, compulsory] of [
        ["Maths", true],
        ["Art", false],
        ["Music", false],
      ] as const) {
        await service.command(owner.id, "subject", {
          schoolId: school.id,
          name,
        });
        const subjectId = (await service.snapshot(owner.id)).subjects.find(
          (x) => x.name === name,
        )!.id;
        await service.command(owner.id, "offering", {
          schoolId: school.id,
          groupId,
          subjectId,
          compulsory,
        });
      }
      const offerings = (await service.snapshot(owner.id)).offerings;
      await service.command(owner.id, "placement", {
        schoolId: school.id,
        groupId,
        studentId: student.id,
      });
      return {
        owner,
        teacher,
        student,
        schoolId: school.id,
        groupId,
        offerings,
      };
    }
    it("persists hashed credentials and supports login after restart", async () => {
      const a = await user("teacher");
      service = new SchoolService(new LocalSchoolRepository(folder));
      const login = await service.login(a.email, "fictional-password-123");
      expect(await service.authenticate(login.token)).toBe(a.id);
      await service.logout(login.token);
      await expect(service.authenticate(login.token)).rejects.toThrow(
        "Sign in",
      );
      await expect(service.login(a.email, "incorrect")).rejects.toThrow(
        "Incorrect",
      );
    });
    it("rejects real data and prevents pending schools from inviting", async () => {
      await expect(service.register({ simulated: false })).rejects.toThrow();
      const owner = await user("owner");
      const school = (await service.command(owner.id, "register-school", {
        name: "Fictional",
        location: "Fictional",
        contact: "fictional.invalid",
        evidence: "Fake",
        levels: ["JSS1"],
      })) as { id: string };
      await expect(
        service.command(owner.id, "invite", {
          schoolId: school.id,
          email: "fake@fictional.invalid",
          role: "teacher",
        }),
      ).rejects.toThrow("not active");
    });
    it("includes compulsory subjects, enforces totals, and requires approval for optional access", async () => {
      const { owner, teacher, student, schoolId, groupId, offerings } =
        await setup();
      expect(await service.canTeach(teacher.id, offerings[0].id)).toBe(false);
      await service.command(owner.id, "assignment", {
        schoolId,
        teacherId: teacher.id,
        offeringId: offerings[0].id,
      });
      expect(await service.canTeach(teacher.id, offerings[0].id)).toBe(true);
      expect(await service.canStudy(student.id, offerings[0].id)).toBe(true);
      await expect(
        service.command(student.id, "submit-enrollment", {
          schoolId,
          groupId,
          offeringIds: [],
        }),
      ).rejects.toThrow("Choose");
      await expect(
        service.command(student.id, "submit-enrollment", {
          schoolId,
          groupId,
          offeringIds: [offerings[1].id, offerings[2].id],
        }),
      ).rejects.toThrow("Choose");
      await service.command(student.id, "submit-enrollment", {
        schoolId,
        groupId,
        offeringIds: [offerings[1].id],
      });
      expect(await service.canStudy(student.id, offerings[1].id)).toBe(false);
      const selection = (await service.snapshot(owner.id)).enrollments[0];
      expect(selection.offeringIds).toContain(offerings[0].id);
      await service.command(owner.id, "approve-enrollment", {
        schoolId,
        id: selection.id,
      });
      expect(await service.canStudy(student.id, offerings[1].id)).toBe(true);
      const membership = (await service.snapshot(owner.id)).memberships.find(
        (m) => m.accountId === student.id,
      )!;
      await service.command(owner.id, "membership", {
        schoolId,
        id: membership.id,
        status: "ended",
      });
      expect(await service.canStudy(student.id, offerings[1].id)).toBe(false);
    });
    it("denies cross-school writes and hides other learners from teachers", async () => {
      const { owner, teacher, student, schoolId } = await setup();
      const outsider = await user("owner", "outsider@fictional.invalid");
      await expect(
        service.command(outsider.id, "subject", { schoolId, name: "Injected" }),
      ).rejects.toThrow("permission");
      const snapshot = await service.snapshot(teacher.id);
      expect(snapshot.accounts.map((a) => a.id)).not.toContain(student.id);
      expect(snapshot.enrollments).toEqual([]);
      await expect(
        service.command(owner.id, "membership", {
          schoolId,
          id: (await service.snapshot(owner.id)).memberships.find(
            (m) => m.accountId === owner.id,
          )!.id,
          status: "ended",
        }),
      ).rejects.toThrow("last owner");
    });
    it("preserves prior approval on policy changes and rejects impossible rules", async () => {
      const { owner, student, schoolId, groupId, offerings } = await setup();
      await service.command(student.id, "submit-enrollment", {
        schoolId,
        groupId,
        offeringIds: [offerings[1].id],
      });
      const e = (await service.snapshot(owner.id)).enrollments[0];
      await service.command(owner.id, "approve-enrollment", {
        schoolId,
        id: e.id,
      });
      await expect(
        service.command(owner.id, "edit-group", {
          schoolId,
          id: groupId,
          name: "JSS1B",
          min: 4,
          max: 4,
        }),
      ).rejects.toThrow("cannot be satisfied");
      await service.command(owner.id, "edit-group", {
        schoolId,
        id: groupId,
        name: "JSS1B",
        min: 1,
        max: 1,
      });
      expect(
        (await service.snapshot(owner.id)).enrollments[0].needsReview,
      ).toBe(true);
      expect(await service.canStudy(student.id, offerings[1].id)).toBe(true);
    });
    it("binds expiring invitations to intended accounts and prevents reuse", async () => {
      const { owner, schoolId } = await setup();
      const teacher = await user("teacher", "another@fictional.invalid");
      const invite = (await service.command(owner.id, "invite", {
        schoolId,
        email: teacher.email,
        role: "teacher",
      })) as { token: string };
      await expect(
        service.command(owner.id, "accept-invite", { token: invite.token }),
      ).rejects.toThrow("belongs");
      await service.command(teacher.id, "accept-invite", {
        token: invite.token,
      });
      await expect(
        service.command(teacher.id, "accept-invite", { token: invite.token }),
      ).rejects.toThrow("expired");
    });
    it("permits teacher-approved external recordings only for unaffiliated students and withdraws on removal", async () => {
      const { owner, teacher, schoolId, offerings } = await setup();
      const outsider = await user("student", "unaffiliated@fictional.invalid");
      const data = {
        schoolId,
        offeringId: offerings[0].id,
        recordingId: "fictional-recording",
        reviewed: true,
        external: true,
      };
      await expect(
        service.command(teacher.id, "publication-audience", data),
      ).rejects.toThrow("assignment");
      await service.command(owner.id, "assignment", {
        schoolId,
        teacherId: teacher.id,
        offeringId: offerings[0].id,
      });
      await service.command(teacher.id, "publication-audience", data);
      expect(
        await service.canAccessPublication(outsider.id, data.recordingId),
      ).toBe(true);
      await service.command(teacher.id, "publication-audience", {
        ...data,
        external: false,
      });
      expect(
        await service.canAccessPublication(outsider.id, data.recordingId),
      ).toBe(false);
      await service.command(teacher.id, "publication-audience", data);
      const membership = (await service.snapshot(owner.id)).memberships.find(
        (m) => m.accountId === teacher.id,
      )!;
      await service.command(owner.id, "membership", {
        schoolId,
        id: membership.id,
        status: "ended",
      });
      expect(
        await service.canAccessPublication(outsider.id, data.recordingId),
      ).toBe(false);
    });
    it("allows teachers in multiple schools but prevents a second active student school", async () => {
      const { teacher, student } = await setup();
      const owner = await user("owner", "second@fictional.invalid");
      const school = (await service.command(owner.id, "register-school", {
        name: "Second simulated school",
        location: "Fictional",
        contact: "fictional.invalid",
        evidence: "Simulated",
        levels: ["SS1"],
      })) as { id: string };
      await service.repository.transaction((s) => {
        s.schools.find((x) => x.id === school.id)!.status = "active";
      });
      for (const account of [teacher, student]) {
        await service.command(account.id, "request-join", {
          schoolId: school.id,
        });
        const m = (await service.snapshot(owner.id)).memberships.find(
          (x) => x.accountId === account.id,
        )!;
        const approval = service.command(owner.id, "membership", {
          schoolId: school.id,
          id: m.id,
          status: "active",
        });
        if (account === student)
          await expect(approval).rejects.toThrow("already has");
        else await approval;
      }
      expect(
        (await service.snapshot(teacher.id)).memberships.filter(
          (x) => x.status === "active",
        ),
      ).toHaveLength(2);
    });
    it("issues student credentials without personal email and requires activation password change", async () => {
      const { owner, schoolId } = await setup();
      const issued = (await service.command(owner.id, "issue-student", {
        schoolId,
        username: "fictional-pupil",
        name: "Fictional pupil",
        schoolAuthorized: true,
      })) as { username: string; initialPassword: string };
      const login = await service.login(
        issued.username,
        issued.initialPassword,
      );
      expect(
        (await service.snapshot(login.account.id)).mustChangePassword,
      ).toBe(true);
      await expect(
        service.command(login.account.id, "request-join", { schoolId }),
      ).rejects.toThrow("initial password");
      await service.command(login.account.id, "change-password", {
        previous: issued.initialPassword,
        password: "new-fictional-password",
      });
      await expect(service.authenticate(login.token)).rejects.toThrow(
        "Sign in",
      );
      expect(
        (await service.login(issued.username, "new-fictional-password")).account
          .id,
      ).toBe(login.account.id);
    });
    it("rejects inconsistent persisted references without committing a partial change", async () => {
      const { student, schoolId } = await setup();
      await expect(
        service.repository.transaction((s) => {
          s.groups[0].schoolId = "foreign-school";
        }),
      ).rejects.toThrow("inconsistent");
      expect((await service.snapshot(student.id)).groups[0].schoolId).toBe(
        schoolId,
      );
      await expect(
        service.repository.transaction((s) => {
          s.memberships.push({
            ...s.memberships.find((m) => m.accountId === student.id)!,
            id: "duplicate-membership",
          });
        }),
      ).rejects.toThrow("inconsistent");
      expect(
        (await service.snapshot(student.id)).memberships.filter(
          (m) => m.status === "active",
        ),
      ).toHaveLength(1);
    });
    it("cascades archived sessions to classes, teaching assignments and placements", async () => {
      const { owner, teacher, student, schoolId, offerings } = await setup();
      await service.command(owner.id, "assignment", {
        schoolId,
        teacherId: teacher.id,
        offeringId: offerings[0].id,
      });
      const session = (await service.snapshot(owner.id)).sessions[0];
      await service.command(owner.id, "archive", {
        schoolId,
        kind: "session",
        id: session.id,
      });
      const state = await service.snapshot(owner.id);
      expect(state.groups.every((g) => g.archived)).toBe(true);
      expect(state.assignments.every((a) => a.archived)).toBe(true);
      expect(state.placements.every((p) => !p.active)).toBe(true);
      expect(await service.canTeach(teacher.id, offerings[0].id)).toBe(false);
      expect(await service.canStudy(student.id, offerings[0].id)).toBe(false);
    });
    it("supports separate senior streams with school-chosen nine-subject limits", async () => {
      const { owner, teacher, schoolId } = await setup();
      const sessionId = (await service.snapshot(owner.id)).sessions[0].id;
      for (const name of ["SS1 Science", "SS1 Arts", "SS1 Commercial"]) {
        await service.command(owner.id, "group", {
          schoolId,
          sessionId,
          level: "SS1",
          name,
          min: 9,
          max: 9,
        });
      }
      const groups = (await service.snapshot(owner.id)).groups.filter(
        (g) => g.level === "SS1",
      );
      expect(groups).toHaveLength(3);
      for (let i = 1; i <= 10; i++) {
        await service.command(owner.id, "subject", {
          schoolId,
          name: `Senior subject ${i}`,
        });
        const subjectId = (await service.snapshot(owner.id)).subjects.find(
          (s) => s.name === `Senior subject ${i}`,
        )!.id;
        await service.command(owner.id, "offering", {
          schoolId,
          groupId: groups[0].id,
          subjectId,
          compulsory: i <= 5,
        });
      }
      const seniorOfferings = (
        await service.snapshot(owner.id)
      ).offerings.filter((o) => o.groupId === groups[0].id);
      for (const offering of seniorOfferings.slice(0, 2))
        await service.command(owner.id, "assignment", {
          schoolId,
          teacherId: teacher.id,
          offeringId: offering.id,
        });
      expect(await service.canTeach(teacher.id, seniorOfferings[1].id)).toBe(
        true,
      );
      await expect(
        service.command(owner.id, "edit-group", {
          schoolId,
          id: groups[0].id,
          name: "SS1 Arts",
          min: 9,
          max: 9,
        }),
      ).rejects.toThrow("already exists");
      expect(
        (await service.snapshot(owner.id)).groups.find(
          (g) => g.id === groups[0].id,
        )?.max,
      ).toBe(9);
    });
  },
);
