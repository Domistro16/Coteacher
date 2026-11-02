import { schoolIntegrity } from "./school-integrity";
import {
  randomUUID,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import Ajv from "ajv/dist/2020.js";
import schema from "../schemas/school-state.schema.json" with { type: "json" };
import type { SchoolState } from "../packages/shared/src/generated/school-state";

export class SchoolError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (message: string, status = 400): never => {
  throw new SchoolError(status, message);
};
const id = () => randomUUID();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const valid = new Ajv({ strict: false }).compile<SchoolState>(schema);
export function checkSchoolState(state: unknown): asserts state is SchoolState {
  if (!valid(state)) throw new Error("Invalid school state contract.");
  schoolIntegrity(state);
}
export function restoreSchoolState(value: Partial<SchoolState>): SchoolState {
  const state = { ...emptySchoolState(), ...value };
  state.accounts.forEach((a) => {
    a.guardianEmail ??= "";
  });
  state.credentials.forEach((c) => {
    c.mustChange ??= false;
  });
  checkSchoolState(state);
  return state;
}
export const schoolLevels = [
  ...Array.from({ length: 6 }, (_, i) => `Primary ${i + 1}`),
  "JSS1",
  "JSS2",
  "JSS3",
  "SS1",
  "SS2",
  "SS3",
];
export function emptySchoolState(): SchoolState {
  return {
    schemaVersion: "1.0.0",
    accounts: [],
    schools: [],
    memberships: [],
    sessions: [],
    groups: [],
    subjects: [],
    offerings: [],
    assignments: [],
    placements: [],
    enrollments: [],
    invitations: [],
    audits: [],
    credentials: [],
    policies: [],
    publications: [],
    identities: [],
    loginSessions: [],
    lessons: [],
    learningRecords: [],
    consents: [],
    uploads: [],
    tutorRecords: [],
    retiredObjects: [],
    privateLearners: [],
    preparedSupport: [],
    placementRequests: [],
  };
}
export interface SchoolRepository {
  transaction<T>(work: (state: SchoolState) => T | Promise<T>): Promise<T>;
}
/** Atomic, serialized local adapter. Never used for public deployment. */
export class LocalSchoolRepository implements SchoolRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private folder: string) {}
  transaction<T>(work: (state: SchoolState) => T | Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      await mkdir(this.folder, { recursive: true });
      const path = join(this.folder, "school-state.json");
      const raw = await readFile(path, "utf8").catch(
        (e: NodeJS.ErrnoException) => {
          if (e.code === "ENOENT") return "";
          throw e;
        },
      );
      const state = restoreSchoolState(raw ? JSON.parse(raw) : {});
      checkSchoolState(state);
      const output = await work(state);
      checkSchoolState(state);
      const temporary = path + "." + id() + ".tmp";
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, path);
      return output;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
type Account = SchoolState["accounts"][number];
export class SchoolService {
  constructor(public repository: SchoolRepository) {}
  /** Explicit fictional local identity adapter; production must supply managed identity. */
  async register(input: Record<string, unknown>) {
    const email = text(input, "email").toLowerCase();
    const name = text(input, "name");
    const role = input.role;
    if (!["owner", "teacher", "student"].includes(String(role)))
      fail("Choose a valid account role.");
    if (input.simulated !== true)
      fail(
        "Only fictional accounts are enabled until public release checks pass.",
        503,
      );
    if(input.registrationAgeBand!==undefined && (!['adult','under-18'].includes(String(input.registrationAgeBand)) || input.registrationAgeBand==='adult' && input.adultSelfAuthorization!==true || input.registrationAgeBand==='under-18' && input.guardianConsent!==true))fail('Choose an age band and the appropriate account authorization.');
    const password = text(input, "password");
    if (password.length < 12) fail("Use at least 12 characters.");
    const account = await this.repository.transaction((s) => {
      if (s.accounts.some((a) => a.email === email))
        fail("Account already exists.", 409);
      const a: Account = {
        id: id(),
        name,
        email,
        role: role as Account["role"],
        verified: false,
        simulated: true,
        guardianEmail: input.registrationAgeBand==='under-18'?email:
          typeof input.guardianEmail === "string"
            ? input.guardianEmail.slice(0, 200)
            : "",
      };
      s.accounts.push(a);
      if(input.registrationAgeBand!==undefined)s.consents.push({id:id(),accountId:a.id,guardianEmail:a.guardianEmail,kind:input.registrationAgeBand==='adult'?'adult-self':'guardian',acceptedAt:new Date().toISOString(),withdrawn:false});
      const salt = randomBytes(16).toString("hex");
      s.credentials.push({
        accountId: a.id,
        salt,
        digest: scryptSync(password, salt, 64).toString("hex"),
        mustChange: false,
      });
      return a;
    });
    return account;
  }
  async login(email: string, password: string) {
    const account = await this.repository.transaction((s) =>
      s.accounts.find((a) => a.email === email.toLowerCase()),
    );
    const credential =
      account &&
      (await this.repository.transaction((s) =>
        s.credentials.find((c) => c.accountId === account.id),
      ));
    if (
      !credential ||
      !timingSafeEqual(
        scryptSync(password, credential.salt, 64),
        Buffer.from(credential.digest, "hex"),
      )
    )
      fail("Incorrect credentials.", 401);
    const token = randomBytes(32).toString("hex");
    await this.repository.transaction((s) => {
      s.loginSessions = s.loginSessions.filter(
        (x) => Date.parse(x.expiresAt) > Date.now(),
      );
      s.loginSessions.push({
        tokenHash: hash(token),
        accountId: account!.id,
        expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
      });
    });
    return { token, account: account! };
  }
  async authenticate(token: string) {
    return this.repository.transaction((s) => {
      const session = s.loginSessions.find(
        (x) =>
          x.tokenHash === hash(token) && Date.parse(x.expiresAt) > Date.now(),
      );
      return session?.accountId ?? fail("Sign in again.", 401);
    });
  }
  async logout(token: string) {
    await this.repository.transaction((s) => {
      s.loginSessions = s.loginSessions.filter(
        (x) => x.tokenHash !== hash(token),
      );
    });
  }
  async managedAccount(
    identity: {
      id: string;
      email: string;
      verified: boolean;
      name?: string;
      role?: string;
      guardianEmail?: string;
      studentRegistrationRoute?: 'adult-self'|'guardian-assisted';
    },
    operatorEmails: string[] = [],
  ) {
    if (!identity.verified) fail("Verify your email before continuing.", 403);
    return this.repository.transaction((s) => {
      const linked = s.identities.find((x) => x.providerId === identity.id);
      if (linked) {
        const account = this.account(s, linked.accountId);
        account.verified = true;
        if (operatorEmails.includes(identity.email.toLowerCase()))
          account.role = "operator";
        else if (account.role === "operator") account.role = "owner";
        return account;
      }
      if (!["owner", "teacher", "student"].includes(identity.role ?? ""))
        fail("Complete account registration first.", 409);
      if (s.accounts.some((a) => a.email === identity.email.toLowerCase()))
        fail(
          "This email is already linked to another account. Contact support.",
          409,
        );
      const account: Account = {
        id: id(),
        name: identity.name?.slice(0, 100) || "Coteacher member",
        email: identity.email.toLowerCase(),
        role: operatorEmails.includes(identity.email.toLowerCase())
          ? "operator"
          : (identity.role as Account["role"]),
        verified: true,
        simulated: process.env.COTEACHER_ALLOW_REAL_STUDENTS !== "true",
        guardianEmail:
          identity.role === "student" && identity.studentRegistrationRoute!=='adult-self' ? identity.email.toLowerCase() : "",
      };
      s.accounts.push(account);
      s.identities.push({ accountId: account.id, providerId: identity.id });
      if (account.role === "student")
        s.consents.push({
          id: id(),
          accountId: account.id,
          guardianEmail: account.email,
          kind: identity.studentRegistrationRoute==='adult-self'?'adult-self':"guardian",
          acceptedAt: new Date().toISOString(),
          withdrawn: false,
        });
      return account;
    });
  }
  async snapshot(actor: string) {
    return this.repository.transaction((s) => {
      const account = this.account(s, actor);
      const schoolIds = new Set(
        s.memberships
          .filter(
            (m) =>
              m.accountId === actor &&
              m.status === "active" &&
              s.schools.some(
                (school) =>
                  school.id === m.schoolId &&
                  (school.status === "active" ||
                    (school.status === "pending" &&
                      ["owner", "admin"].includes(m.role))),
              ),
          )
          .map((m) => m.schoolId),
      );
      const ownSchoolIds = new Set(
        s.memberships
          .filter((m) => m.accountId === actor)
          .map((m) => m.schoolId),
      );
      const adminIds = new Set(
        s.memberships
          .filter(
            (m) =>
              m.accountId === actor &&
              m.status === "active" &&
              ["owner", "admin"].includes(m.role) &&
              s.schools.some(
                (school) =>
                  school.id === m.schoolId &&
                  ["active", "pending"].includes(school.status),
              ),
          )
          .map((m) => m.schoolId),
      );
      const operator = account.role === "operator";
      const visible = (schoolId: string) => adminIds.has(schoolId);
      return {
        account,
        mustChangePassword:
          s.credentials.find((c) => c.accountId === actor)?.mustChange ?? false,
        schools: s.schools.filter((x) => operator || ownSchoolIds.has(x.id)),
        memberships: s.memberships.filter(
          (m) => m.accountId === actor || visible(m.schoolId),
        ),
        accounts: s.accounts.filter(
          (a) =>
            a.id === actor ||
            s.memberships.some(
              (m) => m.accountId === a.id && visible(m.schoolId),
            ),
        ),
        sessions: s.sessions.filter((x) => schoolIds.has(x.schoolId)),
        groups: s.groups.filter((x) => schoolIds.has(x.schoolId)),
        subjects: s.subjects.filter((x) => schoolIds.has(x.schoolId)),
        offerings: s.offerings.filter((x) => schoolIds.has(x.schoolId)),
        policies: s.policies.filter((x) => schoolIds.has(x.schoolId)),
        publications: s.publications.filter(
          (x) => x.teacherId === actor || visible(x.schoolId),
        ),
        assignments: s.assignments.filter(
          (x) => x.teacherId === actor || visible(x.schoolId),
        ),
        placements: s.placements.filter(
          (x) => x.studentId === actor || visible(x.schoolId),
        ),
        placementRequests:s.placementRequests.filter(x=>x.studentId===actor || visible(x.schoolId)),
        enrollments: s.enrollments.filter(
          (x) => x.studentId === actor || visible(x.schoolId),
        ),
        audits: s.audits.filter((x) => visible(x.schoolId)),
        levels: schoolLevels,
      };
    });
  }
  async command(actor: string, action: string, input: Record<string, unknown>) {
    return this.repository.transaction((s) => {
      const account = this.account(s, actor);
      let schoolId = typeof input.schoolId === "string" ? input.schoolId : "";
      let entityId = "";
      let result: unknown = { ok: true };
      if (
        s.credentials.find((c) => c.accountId === actor)?.mustChange &&
        action !== "change-password"
      )
        fail("Change your initial password first.", 403);
      if (action === 'request-learning-placement') {
        if(account.role!=='student')fail('Student account required.',403);
        this.activeSchool(s,schoolId);this.member(s,actor,schoolId,['student']);
        const classLevel=text(input,'classLevel');const subjects=input.subjects;
        if(!Array.isArray(subjects) || !subjects.length || subjects.length>15 || subjects.some(x=>typeof x!=='string' || !x.trim() || x.length>60))fail('Choose the requested subjects.');
        if(s.placementRequests.some(x=>x.studentId===actor && x.schoolId===schoolId && x.status==='pending'))fail('Your school already has a pending placement request.',409);
        s.placementRequests.push({id:id(),studentId:actor,schoolId,classLevel,subjects:[...new Set(subjects as string[])],status:'pending',createdAt:new Date().toISOString()});
      } else if(action==='review-learning-placement') {
        this.activeSchool(s,schoolId);this.member(s,actor,schoolId,['owner','admin']);
        const request=s.placementRequests.find(x=>x.id===input.id && x.schoolId===schoolId)??fail('Placement request not found.',404);
        request.status='reviewed';entityId=request.id;
      } else if (action === "consent") {
        if (account.role !== "student") fail("Student account required.");
        const kind = input.kind === 'local-ai'?'local-ai':input.kind === "external-ai" ? "external-ai" : "guardian";
        s.consents
          .filter((c) => c.accountId === actor && c.kind === kind)
          .forEach((c) => (c.withdrawn = true));
        if (input.accepted === true)
          s.consents.push({
            id: id(),
            accountId: actor,
            guardianEmail: account.guardianEmail,
            kind,
            acceptedAt: new Date().toISOString(),
            withdrawn: false,
          });
      } else if (action === "change-password") {
        const credential =
          s.credentials.find((c) => c.accountId === actor) ??
          fail("Credential not found.");
        const previous = text(input, "previous"),
          password = text(input, "password");
        if (
          !timingSafeEqual(
            scryptSync(previous, credential.salt, 64),
            Buffer.from(credential.digest, "hex"),
          )
        )
          fail("Incorrect current password.", 403);
        if (password.length < 12 || previous === password)
          fail("Choose a different password of at least 12 characters.");
        credential.salt = randomBytes(16).toString("hex");
        credential.digest = scryptSync(password, credential.salt, 64).toString(
          "hex",
        );
        credential.mustChange = false;
        s.loginSessions = s.loginSessions.filter(
          (session) => session.accountId !== actor,
        );
        entityId = actor;
      } else if (action === "register-school") {
        if (account.role !== "owner")
          fail("School owner account required.", 403);
        const levels = strings(input, "levels");
        if (!levels.length || levels.some((l) => !schoolLevels.includes(l)))
          fail("Select valid school levels.");
        const school = {
          id: id(),
          name: text(input, "name"),
          location: text(input, "location"),
          contact: text(input, "contact"),
          evidence: text(input, "evidence"),
          status: "pending" as const,
          reason: "",
          levels,
        };
        schoolId = school.id;
        entityId = school.id;
        s.schools.push(school);
        s.memberships.push({
          id: id(),
          schoolId,
          accountId: actor,
          role: "owner",
          status: "active",
        });
        result = school;
      } else if (action === "review-school") {
        if (account.role !== "operator")
          fail("Platform operator required.", 403);
        const school =
          s.schools.find((x) => x.id === schoolId) ??
          fail("School not found.", 404);
        if (!["active", "rejected", "suspended"].includes(String(input.status)))
          fail("Invalid review status.");
        school.status = input.status as typeof school.status;
        school.reason = text(input, "reason");
        entityId = school.id;
      } else if (action === "request-join") {
        this.activeSchool(s, schoolId);
        if (!["student", "teacher"].includes(account.role))
          fail("Student or teacher account required.");
        if (
          s.memberships.some(
            (m) =>
              m.schoolId === schoolId &&
              m.accountId === actor &&
              ["pending", "active"].includes(m.status),
          )
        )
          fail("Membership already exists.", 409);
        entityId = id();
        s.memberships.push({
          id: entityId,
          schoolId,
          accountId: actor,
          role: account.role as "student" | "teacher",
          status: "pending",
        });
      } else if (action === "accept-invite") {
        const invite =
          s.invitations.find(
            (x) => x.tokenHash === hash(text(input, "token")),
          ) ?? fail("Invitation not found.", 404);
        schoolId = invite.schoolId;
        this.activeSchool(s, schoolId);
        if (
          invite.accepted ||
          Date.parse(invite.expiresAt) < Date.now() ||
          invite.email !== account.email
        )
          fail(
            "Invitation is expired, used or belongs to another account.",
            403,
          );
        if ((invite.role === "student") !== (account.role === "student"))
          fail("Invitation does not match account role.");
        if (
          s.memberships.some(
            (m) =>
              m.schoolId === schoolId &&
              m.accountId === actor &&
              m.status === "active",
          )
        )
          fail("Already affiliated.", 409);
        this.checkStudentSchool(s, actor, invite.role);
        s.memberships = s.memberships.filter(
          (m) =>
            !(
              m.schoolId === schoolId &&
              m.accountId === actor &&
              m.status === "pending"
            ),
        );
        entityId = id();
        s.memberships.push({
          id: entityId,
          schoolId,
          accountId: actor,
          role: invite.role,
          status: "active",
        });
        invite.accepted = true;
      } else if (action === "submit-enrollment") {
        this.member(s, actor, schoolId, ["student"]);
        const groupId = text(input, "groupId");
        if (
          !s.placements.some(
            (p) =>
              p.studentId === actor &&
              p.groupId === groupId &&
              p.schoolId === schoolId &&
              p.active,
          )
        )
          fail("Active class placement required.", 403);
        const offeringIds = this.selection(
          s,
          schoolId,
          groupId,
          strings(input, "offeringIds"),
        );
        if (
          s.enrollments.some(
            (e) =>
              e.studentId === actor &&
              e.groupId === groupId &&
              e.status === "pending",
          )
        )
          fail("A selection is already awaiting approval.", 409);
        entityId = id();
        s.enrollments.push({
          id: entityId,
          schoolId,
          studentId: actor,
          groupId,
          offeringIds,
          status: "pending",
          needsReview: false,
        });
      } else if (action === "publication-audience") {
        const offeringId = text(input, "offeringId");
        const offering =
          s.offerings.find(
            (x) =>
              x.id === offeringId && x.schoolId === schoolId && !x.archived,
          ) ?? fail("Offering not found.", 404);
        this.activeSchool(s, schoolId);
        this.member(s, actor, schoolId, ["teacher", "admin", "owner"]);
        if (
          !s.assignments.some(
            (x) =>
              x.teacherId === actor &&
              x.offeringId === offering.id &&
              !x.archived,
          )
        )
          fail("Teaching assignment required.", 403);
        if (input.reviewed !== true)
          fail(
            "Review recording privacy, instructional accuracy and source distribution rights first.",
          );
        const recordingId = text(input, "recordingId");
        const existing = s.publications.find(
          (x) => x.recordingId === recordingId,
        );
        if (
          existing &&
          (existing.teacherId !== actor || existing.offeringId !== offeringId)
        )
          fail("Recording belongs to another teaching assignment.", 403);
        if (existing) {
          existing.external = input.external === true;
          existing.reviewed = true;
          entityId = existing.id;
        } else {
          entityId = id();
          s.publications.push({
            id: entityId,
            schoolId,
            teacherId: actor,
            offeringId,
            recordingId,
            reviewed: true,
            external: input.external === true,
          });
        }
      } else {
        this.member(s, actor, schoolId, ["owner", "admin"]);
        const school = s.schools.find((x) => x.id === schoolId)!;
        if (action === "edit-school") {
          const levels = strings(input, "levels");
          if (!levels.length || levels.some((l) => !schoolLevels.includes(l)))
            fail("Choose valid school levels.");
          if (
            s.groups.some(
              (g) =>
                g.schoolId === schoolId &&
                !g.archived &&
                !levels.includes(g.level),
            )
          )
            fail("Archive or move class groups before removing their level.");
          school.name = text(input, "name");
          school.levels = levels;
          s.policies = s.policies.filter(
            (p) => p.schoolId !== schoolId || levels.includes(p.level),
          );
          entityId = school.id;
        } else if (action === "promote-admin") {
          this.member(s, actor, schoolId, ["owner"]);
          const member =
            s.memberships.find(
              (m) =>
                m.schoolId === schoolId &&
                m.id === input.id &&
                m.status === "active" &&
                m.role !== "student",
            ) ?? fail("Active staff member required.");
          if (member.role === "owner")
            fail("Use ownership transfer for owners.");
          member.role = "admin";
          entityId = member.id;
        } else if (action === "reset-student-password") {
          const member =
            s.memberships.find(
              (m) =>
                m.schoolId === schoolId &&
                m.accountId === input.studentId &&
                m.role === "student" &&
                m.status === "active",
            ) ?? fail("Active student required.");
          const credential =
            s.credentials.find((c) => c.accountId === member.accountId) ??
            fail("Guardian-managed accounts use email recovery.");
          const initialPassword = randomBytes(18).toString("base64url");
          credential.salt = randomBytes(16).toString("hex");
          credential.digest = scryptSync(
            initialPassword,
            credential.salt,
            64,
          ).toString("hex");
          credential.mustChange = true;
          s.loginSessions = s.loginSessions.filter(
            (session) => session.accountId !== member.accountId,
          );
          entityId = member.accountId;
          result = {
            username: this.account(s, member.accountId).email,
            initialPassword,
          };
        } else if (action === "issue-student") {
          this.activeSchool(s, schoolId);
          const username = text(input, "username").toLowerCase();
          if (!/^[a-z0-9_-]{3,50}$/.test(username))
            fail(
              "Use 3 to 50 letters, numbers, underscores or hyphens for the username.",
            );
          const email = schoolId + ":" + username;
          if (s.accounts.some((a) => a.email === email))
            fail("Student username already exists.", 409);
          const initialPassword = randomBytes(18).toString("base64url");
          if (input.schoolAuthorized !== true)
            fail("Confirm school authorization to issue this student account.");
          entityId = id();
          const salt = randomBytes(16).toString("hex");
          s.accounts.push({
            id: entityId,
            name: text(input, "name"),
            email,
            role: "student",
            verified: false,
            simulated: true,
            guardianEmail:
              typeof input.guardianEmail === "string"
                ? input.guardianEmail.slice(0, 200)
                : "",
          });
          s.credentials.push({
            accountId: entityId,
            salt,
            digest: scryptSync(initialPassword, salt, 64).toString("hex"),
            mustChange: true,
          });
          s.memberships.push({
            id: id(),
            schoolId,
            accountId: entityId,
            role: "student",
            status: "active",
          });
          s.consents.push({
            id: id(),
            accountId: entityId,
            guardianEmail:
              typeof input.guardianEmail === "string"
                ? input.guardianEmail
                : "",
            kind: "school-authorized",
            acceptedAt: new Date().toISOString(),
            withdrawn: false,
          });
          result = { username: email, initialPassword };
        } else if (action === "level-policy") {
          const level = text(input, "level"),
            min = integer(input, "min"),
            max = integer(input, "max");
          if (!school.levels.includes(level) || min > max)
            fail("Invalid level policy.");
          const existing = s.policies.find(
            (x) => x.schoolId === schoolId && x.level === level,
          );
          if (existing) {
            existing.min = min;
            existing.max = max;
            entityId = existing.id;
          } else {
            entityId = id();
            s.policies.push({ id: entityId, schoolId, level, min, max });
          }
        } else if (action === "transfer-owner") {
          this.member(s, actor, schoolId, ["owner"]);
          const target =
            s.memberships.find(
              (x) =>
                x.id === input.id &&
                x.schoolId === schoolId &&
                x.status === "active" &&
                ["owner", "admin"].includes(x.role),
            ) ?? fail("Active administrator required.");
          target.role = "owner";
          const previous = s.memberships.find(
            (x) =>
              x.schoolId === schoolId &&
              x.accountId === actor &&
              x.status === "active",
          )!;
          if (target.id !== previous.id) previous.role = "admin";
          entityId = target.id;
        } else if (action === "rename-subject") {
          const subject =
            s.subjects.find(
              (x) =>
                x.schoolId === schoolId && x.id === input.id && !x.archived,
            ) ?? fail("Subject not found.", 404);
          const name = text(input, "name");
          if (
            s.subjects.some(
              (x) =>
                x.schoolId === schoolId &&
                x.id !== subject.id &&
                x.name.toLowerCase() === name.toLowerCase() &&
                !x.archived,
            )
          )
            fail("Subject already exists.", 409);
          subject.name = name;
          entityId = subject.id;
        } else if (action === "edit-offering") {
          const offering =
            s.offerings.find(
              (x) =>
                x.schoolId === schoolId && x.id === input.id && !x.archived,
            ) ?? fail("Offering not found.", 404);
          const group = this.group(s, schoolId, offering.groupId);
          const compulsory = input.compulsory === true;
          if (
            compulsory &&
            s.offerings.filter(
              (x) =>
                x.groupId === group.id &&
                x.id !== offering.id &&
                x.compulsory &&
                !x.archived,
            ).length >= group.max
          )
            fail("Compulsory subjects exceed maximum.");
          offering.compulsory = compulsory;
          entityId = offering.id;
          s.enrollments
            .filter((x) => x.groupId === group.id && x.status === "approved")
            .forEach((x) => (x.needsReview = true));
        } else if (action === "invite") {
          this.activeSchool(s, schoolId);
          const role = input.role;
          if (!["teacher", "student", "admin"].includes(String(role)))
            fail("Invalid invitation role.");
          const token = randomBytes(32).toString("hex");
          entityId = id();
          s.invitations.push({
            id: entityId,
            schoolId,
            email: text(input, "email").toLowerCase(),
            role: role as "teacher" | "student" | "admin",
            tokenHash: hash(token),
            expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
            accepted: false,
          });
          result = { token, expiresInDays: 7 };
        } else if (action === "membership") {
          const m =
            s.memberships.find(
              (x) => x.id === input.id && x.schoolId === schoolId,
            ) ?? fail("Member not found.", 404);
          if (
            !["active", "rejected", "suspended", "ended"].includes(
              String(input.status),
            )
          )
            fail("Invalid membership status.");
          if (
            m.role === "owner" &&
            input.status !== "active" &&
            s.memberships.filter(
              (x) =>
                x.schoolId === schoolId &&
                x.role === "owner" &&
                x.status === "active",
            ).length <= 1
          )
            fail("Transfer ownership before removing the last owner.");
          if (input.status === "active") {
            this.activeSchool(s, schoolId);
            if (
              s.memberships.some(
                (other) =>
                  other.id !== m.id &&
                  other.schoolId === schoolId &&
                  other.accountId === m.accountId &&
                  other.status === "active",
              )
            )
              fail("This member already has an active affiliation.", 409);
          }
          if (input.status === "active")
            this.checkStudentSchool(s, m.accountId, m.role, m.id);
          m.status = input.status as typeof m.status;
          entityId = m.id;
          if (m.status !== "active") {
            s.placements
              .filter(
                (x) => x.schoolId === schoolId && x.studentId === m.accountId,
              )
              .forEach((x) => (x.active = false));
            s.assignments
              .filter(
                (x) => x.schoolId === schoolId && x.teacherId === m.accountId,
              )
              .forEach((x) => (x.archived = true));
            s.publications
              .filter(
                (x) => x.schoolId === schoolId && x.teacherId === m.accountId,
              )
              .forEach((x) => (x.external = false));
          }
        } else if (action === "session") {
          entityId = id();
          s.sessions.push({
            id: entityId,
            schoolId,
            name: text(input, "name"),
            archived: false,
          });
        } else if (action === "group") {
          const sessionId = text(input, "sessionId"),
            level = text(input, "level");
          if (
            !s.sessions.some(
              (x) =>
                x.id === sessionId && x.schoolId === schoolId && !x.archived,
            ) ||
            !school.levels.includes(level)
          )
            fail("Invalid session or level.");
          const policy = s.policies.find(
            (x) => x.schoolId === schoolId && x.level === level,
          );
          const min =
              input.min === undefined && policy
                ? policy.min
                : integer(input, "min"),
            max =
              input.max === undefined && policy
                ? policy.max
                : integer(input, "max");
          if (min > max) fail("Minimum exceeds maximum.");
          if (
            s.groups.some(
              (g) =>
                g.schoolId === schoolId &&
                g.sessionId === sessionId &&
                g.level === level &&
                g.name.toLowerCase() === text(input, "name").toLowerCase() &&
                !g.archived,
            )
          )
            fail("Class group already exists.", 409);
          entityId = id();
          s.groups.push({
            id: entityId,
            schoolId,
            sessionId,
            level,
            name: text(input, "name"),
            min,
            max,
            archived: false,
          });
        } else if (action === "subject") {
          const name = text(input, "name");
          if (
            s.subjects.some(
              (x) =>
                x.schoolId === schoolId &&
                x.name.toLowerCase() === name.toLowerCase() &&
                !x.archived,
            )
          )
            fail("Subject already exists.", 409);
          entityId = id();
          s.subjects.push({ id: entityId, schoolId, name, archived: false });
        } else if (action === "offering") {
          const g = this.group(s, schoolId, text(input, "groupId"));
          const subjectId = text(input, "subjectId");
          if (
            !s.subjects.some(
              (x) =>
                x.schoolId === schoolId && x.id === subjectId && !x.archived,
            )
          )
            fail("Subject not found.");
          if (
            s.offerings.some(
              (x) =>
                x.groupId === g.id && x.subjectId === subjectId && !x.archived,
            )
          )
            fail("Subject already offered.", 409);
          if (
            input.compulsory === true &&
            s.offerings.filter(
              (x) => x.groupId === g.id && x.compulsory && !x.archived,
            ).length >= g.max
          )
            fail("Compulsory subjects exceed maximum.");
          entityId = id();
          s.offerings.push({
            id: entityId,
            schoolId,
            groupId: g.id,
            subjectId,
            compulsory: input.compulsory === true,
            archived: false,
          });
        } else if (action === "assignment") {
          const teacherId = text(input, "teacherId"),
            offeringId = text(input, "offeringId");
          this.member(s, teacherId, schoolId, ["teacher", "admin", "owner"]);
          if (
            !s.offerings.some(
              (x) =>
                x.id === offeringId && x.schoolId === schoolId && !x.archived,
            )
          )
            fail("Offering not found.");
          if (
            s.assignments.some(
              (x) =>
                x.teacherId === teacherId &&
                x.offeringId === offeringId &&
                !x.archived,
            )
          )
            fail("Assignment exists.", 409);
          entityId = id();
          s.assignments.push({
            id: entityId,
            schoolId,
            teacherId,
            offeringId,
            archived: false,
          });
        } else if (action === "placement") {
          const studentId = text(input, "studentId"),
            group = this.group(s, schoolId, text(input, "groupId"));
          this.member(s, studentId, schoolId, ["student"]);
          s.placements
            .filter(
              (x) =>
                x.studentId === studentId &&
                x.active &&
                s.groups.find((g) => g.id === x.groupId)?.sessionId ===
                  group.sessionId,
            )
            .forEach((x) => (x.active = false));
          entityId = id();
          s.placements.push({
            id: entityId,
            schoolId,
            studentId,
            groupId: group.id,
            active: true,
          });
        } else if (
          action === "approve-enrollment" ||
          action === "reject-enrollment"
        ) {
          const e =
            s.enrollments.find(
              (x) =>
                x.id === input.id &&
                x.schoolId === schoolId &&
                x.status === "pending",
            ) ?? fail("Pending selection not found.", 404);
          if (action === "approve-enrollment") {
            this.member(s, e.studentId, schoolId, ["student"]);
            if (
              !s.placements.some(
                (p) =>
                  p.studentId === e.studentId &&
                  p.groupId === e.groupId &&
                  p.active,
              )
            )
              fail("Placement has changed.");
            e.offeringIds = this.selection(
              s,
              schoolId,
              e.groupId,
              e.offeringIds,
            );
            s.enrollments
              .filter(
                (x) =>
                  x.studentId === e.studentId &&
                  x.groupId === e.groupId &&
                  x.status === "approved",
              )
              .forEach((x) => (x.status = "superseded"));
            e.status = "approved";
            e.needsReview = false;
          } else e.status = "rejected";
          entityId = e.id;
        } else if (action === "edit-group") {
          const g = this.group(s, schoolId, text(input, "id"));
          const min = integer(input, "min"),
            max = integer(input, "max");
          const offerings = s.offerings.filter(
            (x) => x.groupId === g.id && !x.archived,
          );
          const rulesChanged = g.min !== min || g.max !== max;
          if (
            min > max ||
            offerings.filter((x) => x.compulsory).length > max ||
            (rulesChanged && offerings.length < min)
          )
            fail("Subject rules cannot be satisfied.");
          const groupName = text(input, "name");
          if (
            s.groups.some(
              (other) =>
                other.id !== g.id &&
                other.schoolId === schoolId &&
                other.sessionId === g.sessionId &&
                other.level === g.level &&
                !other.archived &&
                other.name.toLowerCase() === groupName.toLowerCase(),
            )
          )
            fail("Class group already exists.", 409);
          g.name = groupName;
          g.min = min;
          g.max = max;
          entityId = g.id;
          if (rulesChanged)
            s.enrollments
              .filter((x) => x.groupId === g.id && x.status === "approved")
              .forEach((x) => (x.needsReview = true));
        } else if (action === "archive") {
          const collections = {
            group: s.groups,
            subject: s.subjects,
            offering: s.offerings,
            assignment: s.assignments,
            session: s.sessions,
          };
          const list =
            collections[input.kind as keyof typeof collections] ??
            fail("Invalid archive kind.");
          const record =
            list.find((x) => x.id === input.id && x.schoolId === schoolId) ??
            fail("Record not found.", 404);
          const archiveGroup = (groupId: string) => {
            const group = s.groups.find((g) => g.id === groupId)!;
            group.archived = true;
            const offeringIds = new Set(
              s.offerings.filter((o) => o.groupId === groupId).map((o) => o.id),
            );
            s.offerings
              .filter((o) => offeringIds.has(o.id))
              .forEach((o) => (o.archived = true));
            s.assignments
              .filter((a) => offeringIds.has(a.offeringId))
              .forEach((a) => (a.archived = true));
            s.placements
              .filter((p) => p.groupId === groupId)
              .forEach((p) => (p.active = false));
          };
          if (input.kind === "session")
            s.groups
              .filter((g) => g.sessionId === record.id)
              .forEach((g) => archiveGroup(g.id));
          if (input.kind === "group") archiveGroup(record.id);
          if (input.kind === "subject") {
            const impacted = s.offerings.filter(
              (o) => o.subjectId === record.id && !o.archived,
            );
            for (const offering of impacted) {
              const group = s.groups.find((g) => g.id === offering.groupId)!;
              if (
                !group.archived &&
                s.offerings.filter(
                  (o) =>
                    o.groupId === group.id &&
                    o.subjectId !== record.id &&
                    !o.archived,
                ).length < group.min
              )
                fail("Archiving makes subject limits impossible.");
              s.enrollments
                .filter(
                  (e) => e.groupId === group.id && e.status === "approved",
                )
                .forEach((e) => (e.needsReview = true));
              offering.archived = true;
              s.assignments
                .filter((a) => a.offeringId === offering.id)
                .forEach((a) => (a.archived = true));
            }
          }
          if (input.kind === "offering" && !record.archived) {
            const offering = s.offerings.find((x) => x.id === record.id)!;
            const group = s.groups.find((g) => g.id === offering.groupId)!;
            if (
              !group.archived &&
              s.offerings.filter(
                (x) =>
                  x.groupId === group.id && x.id !== record.id && !x.archived,
              ).length < group.min
            )
              fail("Archiving makes subject limits impossible.");
            s.enrollments
              .filter((x) => x.groupId === group.id && x.status === "approved")
              .forEach((x) => (x.needsReview = true));
            s.assignments
              .filter((a) => a.offeringId === record.id)
              .forEach((a) => (a.archived = true));
          }
          record.archived = true;
          entityId = record.id;
        } else fail("Unknown school action.", 404);
      }
      s.audits.push({
        id: id(),
        actorId: actor,
        schoolId,
        action,
        entityId,
        at: new Date().toISOString(),
      });
      return result;
    });
  }
  private account(s: SchoolState, actor: string) {
    return (
      s.accounts.find((a) => a.id === actor) ?? fail("Account not found.", 401)
    );
  }
  private activeSchool(s: SchoolState, schoolId: string) {
    if (!s.schools.some((x) => x.id === schoolId && x.status === "active"))
      fail("School is not active.", 403);
  }
  private member(
    s: SchoolState,
    actor: string,
    schoolId: string,
    roles: string[],
  ) {
    const school = s.schools.find((x) => x.id === schoolId);
    if (
      !school ||
      (school.status !== "active" &&
        !(
          school.status === "pending" &&
          roles.every((r) => ["owner", "admin"].includes(r))
        ))
    )
      fail("School is not active.", 403);
    return (
      s.memberships.find(
        (x) =>
          x.schoolId === schoolId &&
          x.accountId === actor &&
          x.status === "active" &&
          roles.includes(x.role),
      ) ?? fail("School permission required.", 403)
    );
  }
  private checkStudentSchool(
    s: SchoolState,
    actor: string,
    role: string,
    except = "",
  ) {
    if (
      role === "student" &&
      s.memberships.some(
        (m) =>
          m.accountId === actor &&
          m.role === "student" &&
          m.status === "active" &&
          m.id !== except,
      )
    )
      fail("Student already has an active school.", 409);
  }
  private group(s: SchoolState, schoolId: string, groupId: string) {
    return (
      s.groups.find(
        (x) =>
          x.id === groupId &&
          x.schoolId === schoolId &&
          !x.archived &&
          s.sessions.some(
            (session) => session.id === x.sessionId && !session.archived,
          ),
      ) ?? fail("Class group not found.", 404)
    );
  }
  private selection(
    s: SchoolState,
    schoolId: string,
    groupId: string,
    choices: string[],
  ) {
    const g = this.group(s, schoolId, groupId),
      offerings = s.offerings.filter((x) => x.groupId === g.id && !x.archived);
    if (choices.some((x) => !offerings.some((o) => o.id === x)))
      fail("Selection contains a subject outside this class.");
    const selected = [
      ...new Set([
        ...offerings.filter((x) => x.compulsory).map((x) => x.id),
        ...choices,
      ]),
    ];
    if (selected.length < g.min || selected.length > g.max)
      fail(`Choose ${g.min}–${g.max} subjects including compulsory subjects.`);
    return selected;
  }
  async canAccessPublication(actor: string, recordingId: string) {
    const publication = await this.repository.transaction((s) => {
      const a = this.account(s, actor);
      if (a.role !== "student") return undefined;
      if (
        process.env.COTEACHER_PUBLIC === "true" &&
        !s.consents.some(
          (c) =>
            c.accountId === actor &&
            !c.withdrawn &&
            ["guardian", "school-authorized",'adult-self'].includes(c.kind),
        )
      )
        return undefined;
      const p = s.publications.find(
        (x) => x.recordingId === recordingId && x.reviewed,
      );
      if (!p) return undefined;
      const offering = s.offerings.find(
        (o) =>
          o.id === p.offeringId &&
          !o.archived &&
          s.subjects.some(
            (subject) => subject.id === o.subjectId && !subject.archived,
          ),
      );
      if (!offering) return undefined;
      try {
        this.group(s, p.schoolId, offering.groupId);
      } catch {
        return undefined;
      }
      try {
        this.activeSchool(s, p.schoolId);
        this.member(s, p.teacherId, p.schoolId, ["teacher", "admin", "owner"]);
      } catch {
        return undefined;
      }
      if (
        !s.assignments.some(
          (x) =>
            x.teacherId === p.teacherId &&
            x.offeringId === p.offeringId &&
            !x.archived,
        )
      )
        return undefined;
      const affiliated = s.memberships.some(
        (x) =>
          x.accountId === actor &&
          x.role === "student" &&
          x.status === "active",
      );
      return { ...p, outside: !affiliated && p.external };
    });
    return publication
      ? publication.outside || this.canStudy(actor, publication.offeringId)
      : false;
  }
  canTeachInState(s: SchoolState, actor: string, offeringId: string) {
    const offering = s.offerings.find(
      (o) =>
        o.id === offeringId &&
        !o.archived &&
        s.subjects.some(
          (subject) => subject.id === o.subjectId && !subject.archived,
        ),
    );
    if (!offering) return false;
    try {
      this.activeSchool(s, offering.schoolId);
      this.member(s, actor, offering.schoolId, ["teacher", "admin", "owner"]);
      this.group(s, offering.schoolId, offering.groupId);
    } catch {
      return false;
    }
    return s.assignments.some(
      (a) =>
        a.offeringId === offeringId && a.teacherId === actor && !a.archived,
    );
  }
  async canTeach(actor: string, offeringId: string) {
    return this.repository.transaction((s) =>
      this.canTeachInState(s, actor, offeringId),
    );
  }
  async canStudy(actor: string, offeringId: string) {
    return this.repository.transaction((s) => {
      const o = s.offerings.find(
        (x) =>
          x.id === offeringId &&
          !x.archived &&
          s.subjects.some(
            (subject) => subject.id === x.subjectId && !subject.archived,
          ),
      );
      if (!o) return false;
      try {
        this.member(s, actor, o.schoolId, ["student"]);
        this.group(s, o.schoolId, o.groupId);
      } catch {
        return false;
      }
      if (
        !s.placements.some(
          (p) => p.studentId === actor && p.groupId === o.groupId && p.active,
        )
      )
        return false;
      return (
        o.compulsory ||
        s.enrollments.some(
          (e) =>
            e.studentId === actor &&
            e.groupId === o.groupId &&
            e.status === "approved" &&
            e.offeringIds.includes(o.id),
        )
      );
    });
  }
}
function text(input: Record<string, unknown>, key: string) {
  const v = input[key];
  if (typeof v !== "string" || !v.trim() || v.length > 2000)
    return fail(`Invalid ${key}.`);
  return v.trim();
}
function strings(input: Record<string, unknown>, key: string): string[] {
  const v = input[key];
  if (
    !Array.isArray(v) ||
    v.length > 100 ||
    v.some((x) => typeof x !== "string") ||
    new Set(v).size !== v.length
  )
    return fail(`Invalid ${key}.`);
  return v;
}
function integer(input: Record<string, unknown>, key: string) {
  const v = input[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100)
    return fail(`Invalid ${key}.`);
  return v;
}
