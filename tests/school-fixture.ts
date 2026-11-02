import {
  approveLessons,
  approvePersonalizedVisuals,
  audioBase64,
  cueForStep,
  demoLessons,
  OpusContainer,
  personalizedReplay,
  reviewRecording,
  startPresentation,
  type LessonRecording,
} from "@coteacher/shared";
import { SchoolService } from "../delivery/school-store";
export async function schoolFixture(service: SchoolService) {
  const create = (role: string, email = `${role}@fictional.invalid`) =>
    service.register({
      name: `Fictional ${role}`,
      email,
      role,
      password: "fictional-password-123",
      simulated: true,
    });
  const owner = await create("owner"),
    teacher = await create("teacher"),
    student = await create("student"),
    outsider = await create("student", "outsider@fictional.invalid");
  const school = (await service.command(owner.id, "register-school", {
    name: "Fictional Academy",
    location: "Fictional location",
    contact: "office@fictional.invalid",
    evidence: "Simulated reference",
    levels: ["JSS2"],
  })) as { id: string };
  await service.repository.transaction((s) => {
    s.schools.find((x) => x.id === school.id)!.status = "active";
  });
  for (const account of [teacher, student]) {
    await service.command(account.id, "request-join", { schoolId: school.id });
    const member = (await service.snapshot(owner.id)).memberships.find(
      (m) => m.accountId === account.id,
    )!;
    await service.command(owner.id, "membership", {
      schoolId: school.id,
      id: member.id,
      status: "active",
    });
  }
  await service.command(owner.id, "session", {
    schoolId: school.id,
    name: "2026/2027",
  });
  const session = (await service.snapshot(owner.id)).sessions[0];
  await service.command(owner.id, "group", {
    schoolId: school.id,
    sessionId: session.id,
    level: "JSS2",
    name: "JSS2A",
    min: 1,
    max: 2,
  });
  const group = (await service.snapshot(owner.id)).groups[0];
  for (const name of ["Science", "Art"]) {
    await service.command(owner.id, "subject", { schoolId: school.id, name });
    const subject = (await service.snapshot(owner.id)).subjects.find(
      (x) => x.name === name,
    )!;
    await service.command(owner.id, "offering", {
      schoolId: school.id,
      groupId: group.id,
      subjectId: subject.id,
      compulsory: name === "Science",
    });
  }
  const offerings = (await service.snapshot(owner.id)).offerings;
  await service.command(owner.id, "assignment", {
    schoolId: school.id,
    teacherId: teacher.id,
    offeringId: offerings[0].id,
  });
  await service.command(owner.id, "placement", {
    schoolId: school.id,
    studentId: student.id,
    groupId: group.id,
  });
  return { owner, teacher, student, outsider, school, group, offerings };
}
/** Synthetic Opus container. Tests do not claim human microphone or audibility verification. */
export function schoolRecording(revisit=false) {
  const original=approveLessons(demoLessons(), true, "2026-10-09T10:00:00Z")[0];
  const prepared=revisit?{...original,lessonId:'refraction-revisit',title:'Refraction: revisit and check the light path'}:original;
  const base = startPresentation(
    prepared,
    "step-light",
    "2026-10-09T10:00:01Z",
    "fictional-classroom",
  );
  const head = new Uint8Array(19);
  head.set(new TextEncoder().encode("OpusHead"));
  head[8] = 1;
  head[9] = 1;
  const view = new DataView(head.buffer);
  view.setUint16(10, 312, true);
  view.setUint32(12, 48000, true);
  const container = new OpusContainer();
  for (let i = 0; i < 101; i++)
    container.add(new Uint8Array([248, 255, 254]), 20000, i ? undefined : head);
  const bytes = container.finish(96000, 48000);
  const raw: LessonRecording = {
    id: revisit?"fictional-recording-revisit":"fictional-recording",
    lessonId: base.lessonId,
    classroomSessionId: "fictional-classroom",
    lessonApprovedAt: "2026-10-09T10:00:00Z",
    startedAt: "2026-10-09T10:00:02Z",
    durationMs: 2000,
    origin: "teacher-microphone",
    audio: {
      mimeType: "audio/ogg;codecs=opus",
      sampleRate: 48000,
      channels: 1,
      mediaKey: audioBase64(new Uint8Array(32).fill(1)),
      dataBase64: audioBase64(bytes),
    },
    cues: [
      cueForStep(base, "step-light", 0),
      cueForStep(base, "step-refraction", 1000),
    ],
    review: { status: "draft" },
  };
  const recording = approvePersonalizedVisuals(
    reviewRecording(raw, true, "2026-10-09T10:00:04Z"),
    true,
    "2026-10-09T10:00:05Z",
  );
  return { lesson: personalizedReplay(base, recording), bytes };
}
