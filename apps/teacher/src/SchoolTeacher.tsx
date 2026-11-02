import { SchoolPublications } from "./SchoolPublications";
import { useState } from "react";
import { AccountGate, AccountSettings } from "../../shared/AccountGate";
import {
  accountApi as api,
  type AccountConfig,
  type AccountSnapshot,
} from "../../shared/account-api";
import { Brand, Icon, LearningArt } from "../../student/src/student-ui";
import { App } from "./App";

export interface TeacherWorkspace {
  accountId: string;
  teacherName: string;
  offeringId: string;
  title: string;
  schoolUrl: string;
  onSwitch?: () => void;
}
export function SchoolTeacher() {
  return (
    <AccountGate kind="teacher">
      {(state, refresh, config) => (
        <TeacherHome state={state} refresh={refresh} config={config} />
      )}
    </AccountGate>
  );
}
function TeacherHome({
  state,
  refresh,
  config,
}: {
  state: AccountSnapshot;
  refresh: () => Promise<void>;
  config: AccountConfig;
}) {
  const [workspace, setWorkspace] = useState<TeacherWorkspace>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState("home");
  const assignments = state.assignments.filter(
    (a) =>
      !a.archived &&
      state.memberships.some(
        (m) =>
          m.accountId === state.account.id &&
          m.schoolId === a.schoolId &&
          m.status === "active",
      ) &&
      state.schools.some((s) => s.id === a.schoolId && s.status === "active"),
  );
  async function join(action: string, data: unknown) {
    setError("");
    setBusy(true);
    try {
      await api("school/" + action, data);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (workspace)
    return (
      <App
        key={workspace.offeringId}
        workspace={{
          ...workspace,
          onSwitch: () => {
            if (
              confirm(
                "Leave this teaching workspace? Your saved work will remain on this device.",
              )
            ) {
              setWorkspace(undefined);
              void refresh();
            }
          },
        }}
      />
    );
  return (
    <div className="student-app teacher-app">
      <aside className="teacher-sidebar">
        <Brand />
        <span className="teacher-brand-label">TEACHER WORKSPACE</span>
        <nav aria-label="Teacher account">
          {[
            ["home", "home", "My teaching"],
            ["publications", "lessons", "Published lessons"],
            ["join", "profile", "Join a school"],
            ["settings", "profile", "Settings"],
          ].map(([id, icon, title]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon name={icon as "home" | "profile" | "lessons"} />
              {title}
            </button>
          ))}
        </nav>
      </aside>
      <div className="teacher-body">
        <header className="teacher-topbar">
          <Brand />
          <span>{state.account.name}</span>
        </header>
        <main className="teacher-content">
          <div className="teacher-page-heading">
            <div>
              <p className="eyebrow">YOUR CLASSROOM, CARRIED FORWARD</p>
              <h1>Welcome back, {state.account.name.split(" ")[0]}.</h1>
              <p>
                Your school assignments connect your lessons to the right
                learners.
              </p>
            </div>
            {state.account.simulated && (
              <span className="workspace-tag">Simulated account</span>
            )}
          </div>
          {error && (
            <p className="app-alert" role="alert">
              {error}
            </p>
          )}
          {page === "home" && (
            <>
              <section className="teacher-welcome">
                <div>
                  <span className="hero-pill">
                    <Icon name="spark" size={16} />
                    Teach once. Reach further.
                  </span>
                  <h2>
                    Your teaching.
                    <br />
                    Their next aha! moment.
                  </h2>
                  <p>Select a class and subject to prepare and record.</p>
                </div>
                <LearningArt />
              </section>
              <h2>Your classes and subjects</h2>
              {!assignments.length && (
                <section className="content-card">
                  <h3>Your teaching workspace is almost ready.</h3>
                  <p>
                    Join a school and ask its administrator to assign your
                    subjects and classes. Recording tools become available after
                    assignment.
                  </p>
                  <button className="primary" onClick={() => setPage("join")}>
                    Join your school
                  </button>
                </section>
              )}
              <div className="teacher-quick-actions">
                {assignments.map((a) => {
                  const o = state.offerings.find((o) => o.id === a.offeringId);
                  const g = state.groups.find((g) => g.id === o?.groupId);
                  const subject = state.subjects.find(
                    (s) => s.id === o?.subjectId,
                  );
                  const school = state.schools.find((s) => s.id === a.schoolId);
                  return (
                    <button
                      disabled={busy}
                      key={a.id}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await api(`teaching/${a.offeringId}/access`);
                          setWorkspace({
                            accountId: state.account.id,
                            teacherName: state.account.name,
                            offeringId: a.offeringId,
                            title: `${school?.name} · ${g?.name} · ${subject?.name}`,
                            schoolUrl: config.schoolUrl,
                          });
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <span className="quick-icon">
                        <Icon name="lessons" />
                      </span>
                      <strong>{subject?.name}</strong>
                      <span>
                        {g?.name} · {school?.name}
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {page === "join" && (
            <section className="content-card">
              <h2>Connect with your school</h2>
              <p>
                Use an invitation from your administrator, or send a request
                with your school ID.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void join(
                    "accept-invite",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <label>
                  Invitation token
                  <input
                    name="token"
                    required
                    defaultValue={
                      new URLSearchParams(location.search).get("invite") ?? ""
                    }
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Accept invitation
                </button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void join(
                    "request-join",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <label>
                  School ID
                  <input name="schoolId" required />
                </label>
                <button disabled={busy}>Request to join</button>
              </form>
              {state.memberships.map((m) => (
                <p key={m.id}>
                  {state.schools.find((s) => s.id === m.schoolId)?.name} ·{" "}
                  {m.status}
                </p>
              ))}
            </section>
          )}
          {page === "publications" && (
            <SchoolPublications state={state} refresh={refresh} />
          )}
          {page === "settings" && (
            <AccountSettings state={state} config={config} />
          )}
        </main>
      </div>
    </div>
  );
}
