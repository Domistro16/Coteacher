import type { SchoolState } from "../packages/shared/src/generated/school-state";

/** Referential checks supplement the closed JSON schema before committing/restoring state. */
export function schoolIntegrity(state: SchoolState) {
  const invalid = (): never => {
    throw new Error(
      "School state contains inconsistent ownership or references.",
    );
  };
  function index<T extends { id: string }>(rows: T[]) {
    const map = new Map(rows.map((row) => [row.id, row]));
    if (map.size !== rows.length) invalid();
    return map;
  }
  const accounts = index(state.accounts),
    schools = index(state.schools),
    sessions = index(state.sessions),
    groups = index(state.groups),
    subjects = index(state.subjects),
    offerings = index(state.offerings),
    lessons = index(state.lessons);
  for (const rows of [
    state.memberships,
    state.assignments,
    state.placements,
    state.enrollments,
    state.invitations,
    state.audits,
    state.policies,
    state.publications,
    state.learningRecords,
    state.consents,
    state.uploads,
    state.tutorRecords,
    state.placementRequests,
  ])
    index<{ id: string }>(rows);
  const student = (id: string) => accounts.get(id)?.role === "student";
  for(const request of state.placementRequests)if(!student(request.studentId) || !schools.has(request.schoolId))invalid();
  if (new Set(state.preparedSupport.map(x=>x.publicationId)).size!==state.preparedSupport.length || state.preparedSupport.some(x=>!lessons.has(x.publicationId) || lessons.get(x.publicationId)!.schoolId!==x.data.schoolId)) invalid();
  if (new Set(state.privateLearners.map(x => x.accountId)).size !== state.privateLearners.length ||
      state.privateLearners.some(x => !student(x.accountId))) invalid();
  const staff = (id: string) => accounts.has(id) && !student(id);
  const sameSchool = (
    row: { schoolId: string } | undefined,
    schoolId: string,
  ) => row?.schoolId === schoolId;
  const activeStudents = new Set<string>(),
    activeMemberships = new Set<string>(),
    placements = new Set<string>();
  for (const m of state.memberships) {
    if (
      !accounts.has(m.accountId) ||
      !schools.has(m.schoolId) ||
      (m.role === "student" && !student(m.accountId)) ||
      (m.role !== "student" && !staff(m.accountId))
    )
      invalid();
    if (m.status === "active") {
      const key = m.accountId + ":" + m.schoolId;
      if (activeMemberships.has(key)) invalid();
      activeMemberships.add(key);
    }
    if (m.status === "active" && m.role === "student") {
      if (activeStudents.has(m.accountId)) invalid();
      activeStudents.add(m.accountId);
    }
  }
  for (const session of state.sessions)
    if (!schools.has(session.schoolId)) invalid();
  for (const group of state.groups)
    if (
      !sameSchool(sessions.get(group.sessionId), group.schoolId) ||
      (!group.archived &&
        !schools.get(group.schoolId)?.levels.includes(group.level)) ||
      group.min > group.max
    )
      invalid();
  for (const subject of state.subjects)
    if (!schools.has(subject.schoolId)) invalid();
  for (const offering of state.offerings)
    if (
      !sameSchool(groups.get(offering.groupId), offering.schoolId) ||
      !sameSchool(subjects.get(offering.subjectId), offering.schoolId)
    )
      invalid();
  for (const assignment of state.assignments)
    if (
      !staff(assignment.teacherId) ||
      !sameSchool(offerings.get(assignment.offeringId), assignment.schoolId)
    )
      invalid();
  for (const p of state.placements) {
    if (!student(p.studentId) || !sameSchool(groups.get(p.groupId), p.schoolId))
      invalid();
    if (p.active) {
      const key = p.studentId + ":" + groups.get(p.groupId)!.sessionId;
      if (placements.has(key)) invalid();
      placements.add(key);
    }
  }
  for (const e of state.enrollments)
    if (
      !student(e.studentId) ||
      !sameSchool(groups.get(e.groupId), e.schoolId) ||
      e.offeringIds.some((id) => offerings.get(id)?.groupId !== e.groupId)
    )
      invalid();
  for (const i of state.invitations)
    if (!schools.has(i.schoolId) || !Number.isFinite(Date.parse(i.expiresAt)))
      invalid();
  for (const policy of state.policies)
    if (
      !schools.get(policy.schoolId)?.levels.includes(policy.level) ||
      policy.min > policy.max
    )
      invalid();
  for (const p of state.publications)
    if (
      !staff(p.teacherId) ||
      !sameSchool(offerings.get(p.offeringId), p.schoolId)
    )
      invalid();
  for (const lesson of state.lessons)
    if (
      !staff(lesson.teacherId) ||
      !sameSchool(offerings.get(lesson.offeringId), lesson.schoolId)
    )
      invalid();
  for (const record of [...state.learningRecords, ...state.tutorRecords])
    if (
      !student(record.studentId) ||
      !sameSchool(lessons.get(record.lessonId), record.schoolId)
    )
      invalid();
  for (const upload of state.uploads)
    if (
      !staff(upload.teacherId) ||
      !sameSchool(offerings.get(upload.offeringId), upload.schoolId) ||
      !Number.isFinite(Date.parse(upload.expiresAt))
    )
      invalid();
  for (const consent of state.consents)
    if (!student(consent.accountId)) invalid();
  for (const identity of state.identities)
    if (!accounts.has(identity.accountId)) invalid();
  for (const credential of state.credentials)
    if (!accounts.has(credential.accountId)) invalid();
  for (const session of state.loginSessions)
    if (
      !accounts.has(session.accountId) ||
      !Number.isFinite(Date.parse(session.expiresAt))
    )
      invalid();
  if (
    new Set(state.identities.map((i) => i.providerId)).size !==
      state.identities.length ||
    new Set(state.credentials.map((c) => c.accountId)).size !==
      state.credentials.length ||
    new Set(state.loginSessions.map((s) => s.tokenHash)).size !==
      state.loginSessions.length
  )
    invalid();
}
