import { useEffect, useState, type FormEvent } from "react";
import type { SchoolService } from "../../../delivery/school-store";
import {
  Brand,
  Icon,
  LearningArt,
  type IconName,
} from "../../student/src/student-ui";
import {
  accountApi as api,
  type AccountConfig,
} from "../../shared/account-api";
import { AccountSettings } from "../../shared/AccountGate";
import { GuardianReviews } from '../../shared/GuardianReviews';

type Snapshot = Awaited<ReturnType<SchoolService["snapshot"]>>;
const presets: Record<string, string[]> = {
  "Primary only": Array.from({ length: 6 }, (_, i) => `Primary ${i + 1}`),
  "Secondary only": ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
  "Primary through JSS": [
    ...Array.from({ length: 6 }, (_, i) => `Primary ${i + 1}`),
    "JSS1",
    "JSS2",
    "JSS3",
  ],
  "Primary through SSS": [
    ...Array.from({ length: 6 }, (_, i) => `Primary ${i + 1}`),
    "JSS1",
    "JSS2",
    "JSS3",
    "SS1",
    "SS2",
    "SS3",
  ],
};
export function SchoolPortal({
  state,
  refresh,
  config,
}: {
  state: Snapshot;
  refresh: () => Promise<void>;
  config: AccountConfig;
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [schoolId, setSchool] = useState(state.schools[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(
    state.account.role === "operator"
      ? "reviews"
      : state.schools.length
        ? "overview"
        : "registration",
  );
  useEffect(() => {
    if (!schoolId && state.schools[0]) setSchool(state.schools[0].id);
  }, [state.schools, schoolId]);
  async function run(path: string, input: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(path, input);
      if (result.token)
        setNotice(
          `Invitation link: ${(input as { role?: string }).role === "teacher" ? config.teacherUrl : (input as { role?: string }).role === "student" ? config.studentUrl : config.schoolUrl}/?invite=${result.token}`,
        );
      else if (result.initialPassword)
        setNotice(
          `Student login: ${result.username} / Initial password (share privately): ${result.initialPassword}`,
        );
      else setNotice("Saved.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(
    e: FormEvent<HTMLFormElement>,
    action: string,
    transform?: (data: Record<string, unknown>) => Record<string, unknown>,
  ) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    let data: Record<string, unknown> = {
      schoolId,
      ...Object.fromEntries(form),
    };
    for (const key of ["min", "max"])
      if (key in data) data[key] = Number(data[key]);
    if ("schoolAuthorized" in data)
      data.schoolAuthorized = data.schoolAuthorized === "true";
    if ("compulsory" in data) data.compulsory = data.compulsory === "true";
    if (transform) data = transform(data);
    void run("school/" + action, data);
  }
  const school = state?.schools.find((x) => x.id === schoolId);
  const membership = state?.memberships.find(
    (m) =>
      m.schoolId === schoolId &&
      m.accountId === state.account.id &&
      m.status === "active",
  );
  const admin = membership && ["owner", "admin"].includes(membership.role);
  const groups =
    state?.groups.filter((g) => g.schoolId === schoolId && !g.archived) ?? [];
  const subjects =
    state?.subjects.filter((s) => s.schoolId === schoolId && !s.archived) ?? [];
  const offerings =
    state?.offerings.filter((o) => o.schoolId === schoolId && !o.archived) ??
    [];
  const labelOffering = (id: string) => {
    const o = offerings.find((x) => x.id === id);
    return o
      ? `${groups.find((g) => g.id === o.groupId)?.name} · ${subjects.find((s) => s.id === o.subjectId)?.name}`
      : id;
  };
  const members =
    state?.memberships.filter((m) => m.schoolId === schoolId) ?? [];
  const name = (id: string) =>
    state?.accounts.find((a) => a.id === id)?.name ?? id;
  const field = (name: string, label: string, type = "text") => (
    <label>
      {label}
      <input name={name} type={type} required maxLength={2000} />
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        name={name}
        required
        onChange={(e) => {
          if (name === "level" && label === "Level") {
            const policy = state.policies.find(
              (p) => p.schoolId === schoolId && p.level === e.target.value,
            );
            if (policy) {
              const form = e.target.form!;
              (form.elements.namedItem("min") as HTMLInputElement).value =
                String(policy.min);
              (form.elements.namedItem("max") as HTMLInputElement).value =
                String(policy.max);
            }
          }
        }}
      >
        <option value="">Choose…</option>
        {options.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
  const save = (label: string) => <button disabled={busy}>{label}</button>;
  const navigation: { id: string; title: string; icon: IconName }[] =
    state.account.role === "operator"
      ? [
          { id: "reviews", title: "School reviews", icon: "check" },
          { id: "settings", title: "Settings", icon: "profile" },
        ]
      : [
          { id: "overview", title: "Overview", icon: "home" },
          { id: "people", title: "Teachers & students", icon: "profile" },
          { id: "classes", title: "Classes", icon: "lessons" },
          { id: "subjects", title: "Subjects & teaching", icon: "spark" },
          { id: "enrollments", title: "Enrollments", icon: "check" },
          { id: "registration", title: "Register school", icon: "arrow" },
          { id: "settings", title: "Settings", icon: "profile" },
        ];
  return (
    <div className="student-app school-app app-shell">
      <aside className="sidebar">
        <Brand />
        <span className="school-brand-label">SCHOOL WORKSPACE</span>
        <nav aria-label="School navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => {
                setPage(n.id);
                setNotice("");
                setError("");
              }}
            >
              <Icon name={n.icon} />
              <span>{n.title}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="spark" />
          <strong>A connected classroom.</strong>
          <p>Your school. More chances to learn.</p>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <span className="mobile-brand">
            <Brand />
          </span>
          <strong>{navigation.find((n) => n.id === page)?.title}</strong>
          <span className="topbar-actions">
            <span className="connection-dot connected">School workspace</span>
            <span className="profile-avatar">
              {state.account.name.slice(0, 1)}
            </span>
          </span>
        </header>
        <nav className="school-mobile-nav" aria-label="School pages">
          <label>
            School pages
            <select value={page} onChange={(e) => setPage(e.target.value)}>
              {navigation.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </label>
        </nav>
        <main id="school-content" className="student-content school-portal">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR SCHOOL, CONNECTED</p>
              <h1>
                {page === "overview"
                  ? `Welcome back, ${state.account.name.split(" ")[0]}.`
                  : navigation.find((n) => n.id === page)?.title}
              </h1>
              <p>Great teaching starts with a well-connected school.</p>
            </div>
            {state.account.simulated && (
              <span className="status-pill">Simulated school data</span>
            )}
          </div>
          {state.schools.length > 0 && (
            <label>
              School workspace
              <select
                value={schoolId}
                onChange={(e) => setSchool(e.target.value)}
              >
                {state.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </label>
          )}
          {school && (
            <p>
              School ID: <code>{school.id}</code> · {school.status}{" "}
              {school.reason}
            </p>
          )}
          {error && (
            <p className="app-alert" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="answer" role="status">
              {notice}
            </p>
          )}
          {page === "overview" && (
            <>
              <section className="welcome-banner">
                <div>
                  <span className="hero-pill">
                    <Icon name="spark" size={16} />A home for your school
                  </span>
                  <h2>
                    Every class.
                    <br />
                    Every learner.
                  </h2>
                  <p>Bring your teachers, subjects and students together.</p>
                  <button onClick={() => setPage("people")}>
                    Manage your school <Icon name="arrow" size={18} />
                  </button>
                </div>
                <LearningArt />
              </section>
              <div className="school-stats">
                {[
                  [
                    "Teachers",
                    members.filter(
                      (m) =>
                        m.role === "teacher" &&
                        m.status === "active",
                    ).length,
                  ],
                  [
                    "Students",
                    members.filter(
                      (m) => m.role === "student" && m.status === "active",
                    ).length,
                  ],
                  ["Class groups", groups.length],
                  ["Subjects", subjects.length],
                ].map(([label, count]) => (
                  <article className="content-card" key={label}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </article>
                ))}
              </div>
              <section className="content-card">
                <h2>Your next steps</h2>
                <p>
                  {school?.status === "active"
                    ? "Invite your teachers, build class groups and approve your students' subject choices."
                    : "Your school is awaiting platform review. You can review its registration details here."}
                </p>
                <div className="school-actions">
                  <button
                    className="primary"
                    onClick={() => setPage("classes")}
                  >
                    Set up classes
                  </button>
                  <button onClick={() => setPage("enrollments")}>
                    Review enrollments
                  </button>
                </div>
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <AccountSettings state={state} config={config} />
              <GuardianReviews />
              {state.placementRequests.filter(r=>r.status==='pending').map(r=><section className="content-card" key={r.id}><h2>Requested class or subject change</h2><p>Learner {r.studentId} requests {r.classLevel}: {r.subjects.join(', ')}.</p><p>Use People and Enrollments to review and apply an approved placement. Marking this request reviewed does not grant access.</p><button onClick={()=>void api('school/review-learning-placement',{schoolId:r.schoolId,id:r.id}).then(refresh)}>Mark placement request reviewed</button></section>)}
              {admin && school && (
                <section className="content-card">
                  <h2>School settings</h2>
                  <form
                    onSubmit={(e) =>
                      submit(e, "edit-school", (d) => ({
                        ...d,
                        levels: String(d.levels)
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      }))
                    }
                  >
                    <label>
                      School name
                      <input name="name" defaultValue={school.name} required />
                    </label>
                    <label>
                      School levels (comma separated)
                      <input
                        name="levels"
                        defaultValue={school.levels.join(", ")}
                        required
                      />
                    </label>
                    {save("Update school")}
                  </form>
                  <h3>Recent school activity</h3>
                  {state.audits
                    .filter((a) => a.schoolId === schoolId)
                    .slice(-30)
                    .reverse()
                    .map((a) => (
                      <p key={a.id}>
                        <time dateTime={a.at}>
                          {new Date(a.at).toLocaleString()}
                        </time>{" "}
                        {name(a.actorId)}: {a.action}
                      </p>
                    ))}
                </section>
              )}
            </>
          )}
          {state.account.role === "owner" && (
            <section hidden={page !== "registration"} className="content-card">
              <h2>Register a school</h2>
              <form
                onSubmit={(e) =>
                  submit(e, "register-school", (d) => ({
                    ...d,
                    levels:
                      d.range === "Custom selection"
                        ? String(d.customLevels ?? "")
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean)
                        : presets[String(d.range)],
                  }))
                }
              >
                {field("name", "School name")}
                {field("location", "Location")}
                {field("contact", "School contact")}
                {field("evidence", "Verification evidence / reference")}
                {select(
                  "range",
                  "Classes offered",
                  [...Object.keys(presets), "Custom selection"].map((x) => ({
                    id: x,
                    name: x,
                  })),
                )}
                <label>
                  Custom levels (comma separated, when selected)
                  <input
                    name="customLevels"
                    placeholder="Primary 1, Primary 2, JSS1"
                  />
                </label>
                {save("Submit for platform review")}
              </form>
            </section>
          )}
          {state.account.role === "operator" && (
            <section hidden={page !== "reviews"} className="content-card">
              <h2>Review schools</h2>
              {state.schools.map((s) => (
                <article key={s.id}>
                  <h3>{s.name}</h3>
                  <p>
                    {s.location} · {s.contact} · {s.evidence}
                  </p>
                  <form
                    onSubmit={(e) =>
                      submit(e, "review-school", (d) => ({
                        ...d,
                        schoolId: s.id,
                      }))
                    }
                  >
                    {select(
                      "status",
                      "Decision",
                      ["active", "rejected", "suspended"].map((x) => ({
                        id: x,
                        name: x,
                      })),
                    )}
                    {field("reason", "Review reason")}
                    {save("Save review")}
                  </form>
                </article>
              ))}
            </section>
          )}
          {admin && school && ["active", "pending"].includes(school.status) && (
            <>
              <section
                hidden={page !== "people" || school?.status !== "active"}
                className="content-card"
              >
                <h2>People and approvals</h2>
                <form onSubmit={(e) => submit(e, "issue-student")}>
                  {field("name", "Student display name")}
                  {field("username", "School-issued username")}
                  <label>
                    Guardian email (optional)
                    <input name="guardianEmail" type="email" />
                  </label>
                  <label className="school-consent">
                    <input
                      type="checkbox"
                      name="schoolAuthorized"
                      value="true"
                      required
                    />
                    Our school is authorized to create this student account.
                  </label>
                  {save("Issue student account")}
                </form>
                <form onSubmit={(e) => submit(e, "invite")}>
                  {field("email", "Account email / username")}
                  {select(
                    "role",
                    "Role",
                    ["teacher", "student", "admin"].map((x) => ({
                      id: x,
                      name: x,
                    })),
                  )}
                  {save("Create invitation")}
                </form>
                {members.map((m) => (
                  <article key={m.id}>
                    <strong>{name(m.accountId)}</strong> · {m.role} · {m.status}
                    {m.role === "student" && m.status === "active" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run("school/reset-student-password", {
                            schoolId,
                            studentId: m.accountId,
                          })
                        }
                      >
                        Reset school-issued password
                      </button>
                    )}
                    {membership?.role === "owner" &&
                      m.role === "teacher" &&
                      m.status === "active" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run("school/promote-admin", { schoolId, id: m.id })
                          }
                        >
                          Make administrator
                        </button>
                      )}
                    {membership?.role === "owner" &&
                      m.role === "admin" &&
                      m.status === "active" && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Transfer school ownership to this administrator?",
                              )
                            )
                              void run("school/transfer-owner", {
                                schoolId,
                                id: m.id,
                              });
                          }}
                        >
                          Transfer ownership
                        </button>
                      )}
                    {m.role !== "owner" && (
                      <div>
                        {["active", "rejected", "suspended", "ended"].map(
                          (status) => (
                            <button
                              key={status}
                              disabled={busy || status === m.status}
                              onClick={() =>
                                run("school/membership", {
                                  schoolId,
                                  id: m.id,
                                  status,
                                })
                              }
                            >
                              {status === "active"
                                ? "Approve / activate"
                                : status}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <section hidden={page !== "classes"} className="content-card">
                <h2>Academic sessions and classes</h2>
                <form onSubmit={(e) => submit(e, "level-policy")}>
                  {select(
                    "level",
                    "Default rules for level",
                    school.levels.map((x) => ({ id: x, name: x })),
                  )}
                  {field("min", "Default minimum", "number")}
                  {field("max", "Default maximum", "number")}
                  {save("Save level default")}
                </form>
                <p>
                  Choose a level to copy its default subject limits. You can
                  adjust them for each class group.
                </p>
                <form onSubmit={(e) => submit(e, "session")}>
                  {field("name", "Session name, e.g. 2026/2027")}
                  {save("Add session")}
                </form>
                <div className="school-sessions">
                  {state.sessions
                    .filter((session) => session.schoolId === schoolId)
                    .map((session) => (
                      <article key={session.id}>
                        <strong>{session.name}</strong>
                        <span>{session.archived ? "Archived" : "Active"}</span>
                        {!session.archived && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "Archive this academic session? Its online classes will close; saved offline lessons remain on devices.",
                                )
                              )
                                void run("school/archive", {
                                  schoolId,
                                  kind: "session",
                                  id: session.id,
                                });
                            }}
                          >
                            Archive session
                          </button>
                        )}
                      </article>
                    ))}
                </div>
                <form onSubmit={(e) => submit(e, "group")}>
                  {select(
                    "sessionId",
                    "Session",
                    state.sessions.filter(
                      (s) => s.schoolId === schoolId && !s.archived,
                    ),
                  )}
                  {select(
                    "level",
                    "Level",
                    school.levels.map((x) => ({ id: x, name: x })),
                  )}
                  {field("name", "Class group, e.g. JSS1A or SS1 Science")}
                  {field("min", "Minimum total subjects", "number")}
                  {field("max", "Maximum total subjects", "number")}
                  {save("Add class group")}
                </form>
                {groups.map((g) => (
                  <form
                    key={g.id}
                    onSubmit={(e) =>
                      submit(e, "edit-group", (d) => ({ ...d, id: g.id }))
                    }
                  >
                    <h3>{g.level}</h3>
                    <label>
                      Group name
                      <input name="name" defaultValue={g.name} required />
                    </label>
                    <label>
                      Minimum
                      <input
                        name="min"
                        type="number"
                        defaultValue={g.min}
                        required
                      />
                    </label>
                    <label>
                      Maximum
                      <input
                        name="max"
                        type="number"
                        defaultValue={g.max}
                        required
                      />
                    </label>
                    {save("Update group and subject limits")}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run("school/archive", {
                          schoolId,
                          kind: "group",
                          id: g.id,
                        })
                      }
                    >
                      Archive class group
                    </button>
                  </form>
                ))}
              </section>
              <section hidden={page !== "subjects"} className="content-card">
                <h2>Subjects and teaching assignments</h2>
                <form onSubmit={(e) => submit(e, "subject")}>
                  {field("name", "Subject name")}
                  {save("Add subject")}
                </form>
                {subjects.map((subject) => (
                  <form
                    key={subject.id}
                    onSubmit={(e) =>
                      submit(e, "rename-subject", (d) => ({
                        ...d,
                        id: subject.id,
                      }))
                    }
                  >
                    <label>
                      Subject name
                      <input name="name" defaultValue={subject.name} required />
                    </label>
                    {save("Rename subject")}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run("school/archive", {
                          schoolId,
                          kind: "subject",
                          id: subject.id,
                        })
                      }
                    >
                      Archive subject
                    </button>
                  </form>
                ))}
                <form onSubmit={(e) => submit(e, "offering")}>
                  {select("groupId", "Class group", groups)}
                  {select("subjectId", "Subject", subjects)}
                  {select("compulsory", "Requirement", [
                    { id: "true", name: "Compulsory" },
                    { id: "false", name: "Optional" },
                  ])}
                  {save("Offer subject")}
                </form>
                <form onSubmit={(e) => submit(e, "assignment")}>
                  {select(
                    "teacherId",
                    "Teacher",
                    members
                      .filter(
                        (m) =>
                          ["teacher", "admin", "owner"].includes(m.role) &&
                          m.status === "active",
                      )
                      .map((m) => ({
                        id: m.accountId,
                        name: name(m.accountId),
                      })),
                  )}
                  {select(
                    "offeringId",
                    "Class and subject",
                    offerings.map((o) => ({
                      id: o.id,
                      name: labelOffering(o.id),
                    })),
                  )}
                  {save("Assign teacher")}
                </form>
                {offerings.map((o) => (
                  <article key={o.id}>
                    <p>
                      {labelOffering(o.id)} ·{" "}
                      {o.compulsory ? "Compulsory" : "Optional"} ·{" "}
                      {state.assignments
                        .filter((a) => a.offeringId === o.id && !a.archived)
                        .map((a) => name(a.teacherId))
                        .join(", ") || "No teacher assigned"}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run("school/edit-offering", {
                          schoolId,
                          id: o.id,
                          compulsory: !o.compulsory,
                        })
                      }
                    >
                      Make {o.compulsory ? "optional" : "compulsory"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run("school/archive", {
                          schoolId,
                          kind: "offering",
                          id: o.id,
                        })
                      }
                    >
                      Archive offering
                    </button>
                    {state.assignments
                      .filter((a) => a.offeringId === o.id && !a.archived)
                      .map((a) => (
                        <button
                          key={a.id}
                          disabled={busy}
                          onClick={() =>
                            run("school/archive", {
                              schoolId,
                              kind: "assignment",
                              id: a.id,
                            })
                          }
                        >
                          Remove {name(a.teacherId)} from this subject
                        </button>
                      ))}
                  </article>
                ))}
              </section>
              <section
                hidden={page !== "enrollments" || school?.status !== "active"}
                className="content-card"
              >
                <h2>Student placement and subject approvals</h2>
                <form onSubmit={(e) => submit(e, "placement")}>
                  {select(
                    "studentId",
                    "Student",
                    members
                      .filter(
                        (m) => m.role === "student" && m.status === "active",
                      )
                      .map((m) => ({
                        id: m.accountId,
                        name: name(m.accountId),
                      })),
                  )}
                  {select("groupId", "Class group", groups)}
                  {save("Place student")}
                </form>
                {state.enrollments
                  .filter((e) => e.schoolId === schoolId)
                  .map((e) => (
                    <article key={e.id}>
                      <strong>{name(e.studentId)}</strong>
                      <p>
                        {e.offeringIds.map(labelOffering).join(", ")} ·{" "}
                        {e.status}
                        {e.needsReview ? " · Rules changed: review needed" : ""}
                      </p>
                      {e.status === "pending" && (
                        <>
                          {["approve", "reject"].map((a) => (
                            <button
                              key={a}
                              disabled={busy}
                              onClick={() =>
                                run("school/" + a + "-enrollment", {
                                  schoolId,
                                  id: e.id,
                                })
                              }
                            >
                              {a}
                            </button>
                          ))}
                        </>
                      )}
                    </article>
                  ))}
              </section>
            </>
          )}
        </main>
        <footer className="app-footer">
          <Brand />
          <span>Another chance at the lesson.</span>
        </footer>
      </div>
    </div>
  );
}
