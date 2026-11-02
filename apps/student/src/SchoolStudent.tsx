import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyProgress,
  initialTutorState,
  observedMemory,
  identifyProgressEvents,
  mergeReturnedAnswers,
  progressDigest,
  pendingProgress,
  validateProgressReceipt,
  type ProgressSyncState,
  type LessonPackage,
} from "@coteacher/shared";
import { AccountGate, AccountSettings } from "../../shared/AccountGate";
import {
  accountApi as api,
  defaultConfig,
  type AccountConfig,
  type AccountSnapshot,
} from "../../shared/account-api";
import { Brand, Icon, LearningArt, clock } from "./student-ui";
import { StudentPlayer } from "./StudentPlayer";
import { GuardianVerification, LearningPreferences } from './LearningPreferences';
import { clearPrivateLearning,readPrivateLearning, readStoredProfile, saveStoredProfile, type Snapshot } from "./storage";
import { completeLearnerLesson, emptyPrivateMemory,mergePrivateMemory, optionalPrompt, updateLearnerEvidence } from '../../../packages/shared/src/learning-engine';
import { initialPlayerState, createPlayerModel } from "./player";
import {
  downloadRecordedLesson,
  type DownloadProgress,
} from "./lesson-delivery";
import {
  ConnectedTutorContext,
  useConnectedTutor,
  type TutorTransport,
} from "./useConnectedTutor";

interface SavedLesson {
  key: string;
  learnerId: string;
  accountId: string;
  lessonId: string;
  title: string;
  complete?: boolean;
}
const registryKey = "coteacher-school-downloads-v1";
function savedLessons(): SavedLesson[] {
  try {
    const value = JSON.parse(localStorage.getItem(registryKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (x) =>
            typeof x.key === "string" &&
            /^student-[a-f0-9]{24}$/.test(x.learnerId) &&
            typeof x.title === "string" &&
            typeof x.lessonId === "string" &&
            typeof x.accountId === "string",
        )
      : [];
  } catch {
    return [];
  }
}
function registerSaved(entry: SavedLesson) {
  const all = savedLessons();
  localStorage.setItem(
    registryKey,
    JSON.stringify([...all.filter((x) => x.key !== entry.key), entry]),
  );
}
export function SchoolStudent() {
  if (location.hash.startsWith('#guardian=')) return <GuardianVerification />;
  return <SchoolStudentApp />;
}
function SchoolStudentApp() {
  const [capabilities, setCapabilities] = useState(defaultConfig);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [localOnly, setLocalOnly] = useState(true);
  const [localScreen, setLocalScreen] = useState(() =>
    savedLessons().some((x) => x.complete),
  );
  const [saved, setSaved] = useState(savedLessons);
  const [selection, setSelection] = useState<SavedLesson>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    const disconnected = () => {
      setOffline(true);
      setLocalOnly(true);
    };
    const connected = () => {
      setOffline(false);
      setLocalOnly(false);
      void api("config")
        .then(setCapabilities)
        .catch(() => {});
    };
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() =>
          setError(
            "Offline app setup did not finish. Keep this page open and retry while connected.",
          ),
        );
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  const open = async (entry: SavedLesson, password: string) => {
    try {
      const value = await readStoredProfile(
        entry.learnerId,
        password,
        entry.key,
      );
      if (!value) throw new Error("This lesson is not saved on this device.");
      if (!entry.complete && "mediaUrl" in value.lesson.recording!.audio)
        throw new Error(
          "Connect to finish downloading this recording before studying offline.",
        );
      setLocalOnly(true);
      setSelection(entry);
      setSnapshot(value);
      setPin(password);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (selection && snapshot)
    return (
      <SchoolStudy
        entry={selection}
        initial={snapshot}
        pin={pin}
        offline={offline || localOnly}
        liveAvailable={capabilities.liveVoice}
        tutorAvailable={capabilities.connectedTutor}
        speechAvailable={capabilities.connectedSpeech??true}
        providerName={capabilities.textProvider==='llama.cpp'?'the school’s local text tutor':capabilities.textProvider==='mock'?'a simulated test tutor':'OpenAI'}
        onReconnect={() => {
          setOffline(false);
          setLocalOnly(false);
          void api("config")
            .then(setCapabilities)
            .catch(() => {});
        }}
        offlineReady={offlineReady}
        onLock={() => {
          window.dispatchEvent(new Event("coteacher-lock"));
          setSelection(undefined);
          setSnapshot(undefined);
          setPin("");
          setSaved(savedLessons());
        }}
      />
    );
  const offlineLibrary = (
    <section className="content-card">
      <h2>Saved on this device</h2>
      <p>
        Unlock a downloaded lesson with its device PIN. Your account password is
        separate.
      </p>
      {saved.map((entry) => (
        <form
          key={entry.key}
          data-saved-learner-id={entry.learnerId}
          className="offline-unlock"
          onSubmit={(e) => {
            e.preventDefault();
            void open(entry, String(new FormData(e.currentTarget).get("pin")));
          }}
        >
          <h3>{entry.title}</h3>
          <p>Learner {entry.learnerId.slice(-6)}</p>
          <label>
            Device PIN
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              minLength={6}
              maxLength={6}
              required
              autoComplete="off"
            />
          </label>
          <button className="primary" disabled={!entry.complete}>
            Unlock saved lesson
          </button>
          {!entry.complete && (
            <p>Connect to finish downloading this recording.</p>
          )}
        </form>
      ))}
      {!saved.length && (
        <p>
          Connect to your school and download a complete lesson before studying
          offline.
        </p>
      )}
    </section>
  );
  if (offline || localScreen)
    return (
      <main className="student-app student-content">
        <Brand />
        <h1>Your classroom, anywhere.</h1>
        <p>
          Your complete downloads are ready to unlock, without signing in
          online.
        </p>
        <button
          disabled={offline}
          onClick={() => {
            setLocalScreen(false);
            setLocalOnly(false);
          }}
        >
          Open online school library
        </button>
        {error && (
          <p role="alert" className="app-alert">
            {error}
          </p>
        )}
        {offlineLibrary}
      </main>
    );
  return (
    <>
      {saved.some((x) => x.complete) && (
        <button
          className="text-action"
          onClick={() => {
            setLocalScreen(true);
            setLocalOnly(true);
          }}
        >
          Open saved lessons on this device
        </button>
      )}
      <AccountGate kind="student">
        {(state, refresh, config) => (
          <StudentHome
            state={state}
            refresh={refresh}
            config={config}
            offlineLibrary={offlineLibrary}
            error={error}
            onOpen={(entry, value, password) => {
              setCapabilities(config);
              setLocalOnly(false);
              setSelection(entry);
              setSnapshot(value);
              setPin(password);
            }}
          />
        )}
      </AccountGate>
    </>
  );
}
function StudentHome({
  state,
  refresh,
  config,
  offlineLibrary,
  error,
  onOpen,
}: {
  state: AccountSnapshot;
  refresh: () => Promise<void>;
  config: AccountConfig;
  offlineLibrary: React.ReactNode;
  error: string;
  onOpen: (entry: SavedLesson, snapshot: Snapshot, pin: string) => void;
}) {
  const [page, setPage] = useState("home");
  const [greetingName,setGreetingName]=useState(state.account.name);
  const [lessons, setLessons] = useState<
    { id: string; title: string; publishedAt: string }[]
  >([]);
  const [message, setMessage] = useState(error);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState("");
  async function load() {
    try {
      setLessons(await api("lessons"));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [state.account.id]);
  useEffect(()=>{
    if(page!=='home')return;
    let active=true;
    void api('learner/profile').then(p=>{if(active)setGreetingName(p.personalizationAllowed && p.answers.preferredName?p.answers.preferredName:state.account.name);}).catch(()=>{});
    return()=>{active=false;};
  },[state.account.id,page]);
  async function action(name: string, data: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await api("school/" + name, data);
      await refresh();
      setMessage("Saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function watch(lessonId: string, pin: string) {
    setBusy(true);
    setMessage("");
    try {
      const lesson: LessonPackage = await api("lessons/" + lessonId);
      const key = `${lesson.studentId}:${lessonId}`;
      const previous = await readStoredProfile(lesson.studentId, pin, key);
      let snapshot:Snapshot = previous ? {...previous,lesson:{...lesson,recording:{...lesson.recording!,audio:previous.lesson.recording!.audio}}} : {
        lesson,
        progress: emptyProgress(lesson),
        player: initialPlayerState(createPlayerModel(lesson)),
      };
      const learning=await api(`lessons/${lessonId}/learning`);
      const localMemory=await readPrivateLearning(lesson.studentId,pin);
      snapshot={...snapshot,learning:{...learning,memory:mergePrivateMemory(localMemory,learning.memory,new Date().toISOString())}};
      await saveStoredProfile(lesson.studentId, pin, snapshot, key);
      const entry = {
        complete:
          !!previous?.lesson.recording &&
          !("mediaUrl" in previous.lesson.recording.audio),
        key,
        learnerId: lesson.studentId,
        accountId: state.account.id,
        lessonId,
        title: lesson.title,
      };
      registerSaved(entry);
      onOpen(entry, snapshot, pin);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="student-app app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Main navigation">
          {[
            ["home", "Home", "home"],
            ["lessons", "My Lessons", "lessons"],
            ["subjects", "Subjects", "check"],
            ["downloads", "Downloads", "download"],
            ["school", "My school", "profile"],
            ["profile", "Profile", "profile"],
          ].map(([id, title, icon]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon
                name={
                  icon as "home" | "lessons" | "check" | "download" | "profile"
                }
              />
              <span>{title}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="spark" />
          <strong>A little every day.</strong>
          <p>Your lesson. Your pace.</p>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <span className="mobile-brand">
            <Brand />
          </span>
          <strong>Your learning space</strong>
          <span className="connection-dot connected">Connected</span>
        </header>
        <main className="student-content">
          {message && (
            <p className="app-alert" role="status">
              {message}
            </p>
          )}
          {(page === "home" || page === "lessons") && (
            <>
              <section className="greeting">
                <p className="eyebrow">GOOD TO SEE YOU</p>
                <h1>Hey, {greetingName}!</h1>
                <p>Your teacher’s lessons, ready for another look.</p>
              </section>
              <section className="content-card"><h2>Make this your learning space</h2><p>A few short questions help Coteacher choose useful support. You can keep learning with the default route.</p><button onClick={()=>setPage('preferences')}>Set up my learning preferences</button></section>
              {page === "home" && (
                <section className="welcome-banner">
                  <div>
                    <span className="hero-pill">
                      <Icon name="spark" size={16} />A fresh way to learn
                    </span>
                    <h2>
                      Big ideas.
                      <br />
                      At your own pace.
                    </h2>
                    <p>Press play, get curious, and make every lesson yours.</p>
                    <button onClick={() => setPage("lessons")}>
                      Explore my lessons <Icon name="arrow" size={18} />
                    </button>
                  </div>
                  <LearningArt />
                </section>
              )}
              <div className="section-heading">
                <h2>My Lessons</h2>
                <button onClick={load}>Refresh lessons</button>
              </div>
              {!lessons.length && (
                <section className="content-card">
                  <h3>Your next lesson is on its way.</h3>
                  <p>
                    Join your school and complete subject enrollment to see its
                    recordings. If you have no school, teachers can choose to
                    share recordings with you.
                  </p>
                  <button onClick={() => setPage("school")}>
                    Connect with your school
                  </button>
                </section>
              )}
              <div className="lesson-grid">
                {lessons.map((l) => (
                  <article className="lesson-card" key={l.id}>
                    <div className="lesson-card-body">
                      <span className="subject-label">CLASSROOM RECORDING</span>
                      <h3>{l.title}</h3>
                      <p>
                        Published {new Date(l.publishedAt).toLocaleDateString()}
                      </p>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => setChosen(l.id)}
                      >
                        Watch lesson <Icon name="play" size={18} />
                      </button>
                      {chosen === l.id && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void watch(
                              l.id,
                              String(new FormData(e.currentTarget).get("pin")),
                            );
                          }}
                        >
                          <label>
                            Device PIN (six digits)
                            <input
                              name="pin"
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]{6}"
                              maxLength={6}
                              required
                              autoComplete="off"
                            />
                          </label>
                          <p className="helper-note">
                            Choose a PIN for a new download, or use the PIN you
                            already set for this lesson.
                          </p>
                          <button className="primary" disabled={busy}>
                            Open my lesson
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {page === "downloads" && offlineLibrary}
          {page === "school" && (
            <section className="content-card">
              <h1>My school</h1>
              <p>Your school approves your affiliation and class placement.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    "request-join",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <label>
                  School ID
                  <input name="schoolId" required />
                </label>
                <button className="primary" disabled={busy}>
                  Request to join
                </button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
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
                <button disabled={busy}>Accept invitation</button>
              </form>
              {state.memberships.map((m) => (
                <p key={m.id}>
                  {state.schools.find((s) => s.id === m.schoolId)?.name} ·{" "}
                  {m.status}
                </p>
              ))}
            </section>
          )}
          {page === "subjects" && (
            <>
              <h1>Your subjects</h1>
              {state.placements
                .filter((p) => p.active)
                .map((p) => {
                  const g = state.groups.find((g) => g.id === p.groupId);
                  const offerings = state.offerings.filter(
                    (o) => o.groupId === p.groupId && !o.archived,
                  );
                  const existing = state.enrollments
                    .filter(
                      (e) =>
                        e.groupId === p.groupId &&
                        ["pending", "approved"].includes(e.status),
                    )
                    .at(-1);
                  return (
                    <section className="content-card" key={p.id}>
                      <h2>{g?.name}</h2>
                      <p>
                        Choose {g?.min}–{g?.max} subjects in total, including
                        compulsory subjects.
                      </p>
                      <form
                        key={existing?.id ?? p.groupId}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action("submit-enrollment", {
                            schoolId: p.schoolId,
                            groupId: p.groupId,
                            offeringIds: new FormData(e.currentTarget).getAll(
                              "offeringIds",
                            ),
                          });
                        }}
                      >
                        {offerings.map((o) => (
                          <label key={o.id}>
                            <input
                              name="offeringIds"
                              type="checkbox"
                              value={o.id}
                              disabled={o.compulsory}
                              defaultChecked={
                                o.compulsory ||
                                existing?.offeringIds.includes(o.id)
                              }
                            />
                            {
                              state.subjects.find((s) => s.id === o.subjectId)
                                ?.name
                            }
                            {o.compulsory ? " (compulsory)" : ""}
                          </label>
                        ))}
                        <button
                          className="primary"
                          disabled={busy || existing?.status === "pending"}
                        >
                          Submit for school approval
                        </button>
                      </form>
                      {state.enrollments
                        .filter((e) => e.groupId === p.groupId)
                        .map((e) => (
                          <p key={e.id}>
                            Subject selection: {e.status}
                            {e.needsReview
                              ? " · School rules changed; review needed"
                              : ""}
                          </p>
                        ))}
                    </section>
                  );
                })}
              {!state.placements.some((p) => p.active) && (
                <p>
                  Your school will assign your class before subject selection
                  opens.
                </p>
              )}
            </>
          )}
          {page === "profile" && (
            <><button onClick={()=>setPage('preferences')}>My learning preferences</button><AccountSettings state={state} config={config} /></>
          )}
          {page === 'preferences' && <LearningPreferences state={state} onClose={()=>setPage('home')} onPrivacyClear={()=>clearPrivateLearning(savedLessons().filter(x=>x.accountId===state.account.id).map(x=>x.learnerId))}/>}
        </main>
        <footer className="app-footer">
          <Brand />
          <span>Another chance at the lesson.</span>
        </footer>
      </div>
    </div>
  );
}
function SchoolStudy({
  entry,
  initial,
  pin,
  offline,
  offlineReady,
  onLock,
  onReconnect,
  tutorAvailable,
  liveAvailable,
  speechAvailable,
  providerName,
}: {
  entry: SavedLesson;
  initial: Snapshot;
  pin: string;
  offline: boolean;
  offlineReady: boolean;
  onLock: () => void;
  onReconnect: () => void;
  tutorAvailable: boolean;
  liveAvailable: boolean;
  speechAvailable:boolean;
  providerName:string;
}) {
  const [snapshot, setSnapshot] = useState(initial),
    [saved, setSaved] = useState("Saving on this device…"),
    [error, setError] = useState(""),
    [sync, setSync] = useState(""),
    [received, setReceived] = useState<ProgressSyncState>(),
    [download, setDownload] = useState<DownloadProgress>();
  const [busy, setBusy] = useState(false);
  const current = useRef(snapshot);
  current.current = snapshot;
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  function update(next: Snapshot) {
    const progress = identifyProgressEvents(next.progress);
    const tutor = next.tutor ?? initialTutorState(next.lesson);
    let checked:Snapshot = {
      ...next,
      progress,
      tutor: {
        ...tutor,
        memory: observedMemory(
          next.lesson,
          progress,
          tutor.memory,
          tutor.checks,
          tutor.checkAttempts,
        ),
      },
    };
    if(checked.learning?.support){
      const knowledge=checked.learning.support.knowledge;
      let memory=updateLearnerEvidence(checked.learning.memory,checked.lesson,progress,knowledge,new Date().toISOString(),checked.tutor);
      checked={...checked,learning:{...checked.learning,memory}};
    }
    current.current = checked;
    setSnapshot(checked);
  }
  const session = useMemo(
    () => ({ id: entry.learnerId, pin }),
    [entry.learnerId, pin],
  );
  useEffect(()=>{
    if(typeof BroadcastChannel==='undefined')return;
    const channel=new BroadcastChannel('coteacher-learning-privacy');
    channel.onmessage=(event:MessageEvent<unknown>)=>{
      const message=event.data as {clearedLearners?:unknown};
      if(!Array.isArray(message?.clearedLearners) || !message.clearedLearners.includes(entry.learnerId))return;
      const latest=current.current;if(!latest.learning)return;
      window.dispatchEvent(new Event('coteacher-lock'));
      update({...latest,learning:{...latest.learning,memory:emptyPrivateMemory(entry.learnerId)}});
    };
    return()=>channel.close();
  },[entry.learnerId]);
  const transport = useMemo<TutorTransport>(
    () => ({
      key: entry.lessonId,
      // Managed identity, authorization and durable private objects require several
      // provider round trips before the progress receipt can be returned.
      timeoutMs: 45000,
      url: (_id, _recording, suffix = "") =>
        `/api/v1/lessons/${entry.lessonId}/tutor${suffix}`,
      progressUrl: () => `/api/v1/lessons/${entry.lessonId}/progress`,
      encode: async (value) => value,
      decode: async (value) => value,
    }),
    [entry.lessonId],
  );
  const tutor = useConnectedTutor(
    session,
    snapshot,
    !offline && tutorAvailable,
    saved,
    update,
    current,
    onReconnect,
    transport,
  );
  useEffect(()=>{
    if(offline)return;
    let active=true;
    void api(`lessons/${entry.lessonId}/learning`).then(learning=>{
      if(!active)return;const latest=current.current;
      update({...latest,learning:{...learning,memory:mergePrivateMemory(latest.learning?.memory??null,learning.memory,new Date().toISOString())}});
    }).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[offline,entry.lessonId]);
  useEffect(() => {
    const revision = ++generation.current;
    setSaved("Saving on this device…");
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (revision !== generation.current) return;
        await saveStoredProfile(entry.learnerId, pin, snapshot, entry.key);
        if (revision === generation.current) setSaved("Saved on this device");
      })
      .catch((e) => {
        setSaved("Not saved — retry before leaving");
        setError(e.message);
      });
  }, [snapshot, entry.key, pin]);
  useEffect(() => {
    if (offline || saved !== "Saved on this device") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function send() {
      try {
        const local = current.current;
        const record = {
          ...local.progress,
          exportedAt: new Date().toISOString(),
        };
        const digest = await progressDigest(record);
        const response = await fetch(
          `/api/v1/lessons/${entry.lessonId}/progress`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
            signal: controller.signal,
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (
          !validateProgressReceipt(result.receipt) ||
          result.receipt.sha256 !== digest ||
          result.receipt.studentId !== entry.learnerId ||
          result.receipt.lessonId !== local.lesson.lessonId ||
          result.receipt.recordingId !== local.lesson.recording?.id
        )
          throw new Error("The school did not acknowledge this progress.");
        if (active) {
          setSync("");
          setReceived({
            receipt: result.receipt,
            eventIds: record.events.map((event) => event.eventId!),
            questionIds: record.queuedQuestions.map((question) => question.id),
          });
          const learning=current.current.learning;
          if(learning?.support){const key=learning.support.knowledge.lessonId+'@'+learning.support.knowledge.lessonRevision;
            if(learning.memory.completedLessons.some(l=>l.lessonId===key))await api(`lessons/${entry.lessonId}/learning`,{completed:true,promptDismissed:learning.memory.promptedLessons.includes(key)});
          }
          const returned = await api(`lessons/${entry.lessonId}/progress`);
          if (active && returned) {
            const latest = current.current;
            const merged = mergeReturnedAnswers(
              latest.progress,
              returned,
              latest.lesson,
            );
            if (
              JSON.stringify(merged.queuedQuestions) !==
              JSON.stringify(latest.progress.queuedQuestions)
            )
              update({ ...latest, progress: merged });
          }
        }
      } catch (e) {
        if (active)
          setSync(
            (e as Error).message + " Your progress remains on this device.",
          );
      } finally {
        if (active) timer = setTimeout(send, 30000);
      }
    }
    timer = setTimeout(send, 1800);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [offline, saved, entry.lessonId, entry.learnerId]);
  const complete =
    !!snapshot.lesson.recording &&
    !("mediaUrl" in snapshot.lesson.recording.audio);
  async function lock() {
    window.dispatchEvent(new Event("coteacher-pause-recording"));
    await queue.current;
    await saveStoredProfile(entry.learnerId, pin, current.current, entry.key);
    onLock();
  }
  async function downloadLesson() {
    setBusy(true);
    setError("");
    try {
      const full = await downloadRecordedLesson(
        current.current.lesson,
        setDownload,
      );
      await queue.current;
      const next = { ...current.current, lesson: full };
      await saveStoredProfile(entry.learnerId, pin, next, entry.key);
      registerSaved({ ...entry, complete: true });
      update(next);
      setDownload((value) => value && { ...value, phase: "complete" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = received
    ? pendingProgress(snapshot.progress, received)
    : null;
  const syncMessage =
    sync ||
    (pending && !pending.events && !pending.questions
      ? "School received your progress."
      : "Your latest progress is saved here and waiting to reach school.");
  return (
    <ConnectedTutorContext.Provider value={tutor}>
      <div className="student-app">
        <header className="app-topbar">
          <Brand />
          <span>{offline ? "Offline" : "Connected"}</span>
          <button
            className="lock-button"
            aria-label="Lock / switch learner"
            title="Lock / switch learner"
            disabled={busy}
            onClick={() => void lock().catch((e) => setError(e.message))}
          >
            <Icon name="profile" />
          </button>
        </header>
        <main className="student-content watch-content">
          <div className="watch-toolbar">
            <span role="status">{saved}</span>
            {!complete && (
              <button disabled={busy || offline} onClick={downloadLesson}>
                <Icon name="download" />
                Download for offline use
              </button>
            )}
            <span>
              {complete && offlineReady
                ? "Ready offline"
                : complete
                  ? "Audio saved; finish offline app setup"
                  : "Streaming recording"}
            </span>
          </div>
          {snapshot.learning?.support && <div className="lesson-completion"><button onClick={()=>{
            const learning=current.current.learning!;const memory=completeLearnerLesson(learning.memory,learning.support!.knowledge,new Date().toISOString());update({...current.current,learning:{...learning,memory}});
            // The background return sends completion after a validated progress
            // receipt. An eager request can race the first progress submission.
          }}>Finish this lesson</button><span>Completion is your study record, not a mastery claim.</span>
          {optionalPrompt(snapshot.learning.memory,snapshot.learning.support.knowledge) && <p>Want to add interests or study preferences? You can edit them in Profile next time you open your school library. <button onClick={()=>{const l=current.current.learning!;const id=optionalPrompt(l.memory,l.support!.knowledge)!;update({...current.current,learning:{...l,memory:{...l.memory,promptedLessons:[...l.memory.promptedLessons,id]}}});}}>Dismiss preference prompt</button></p>}</div>}
          {error && (
            <p className="app-alert" role="alert">
              {error}
              <button onClick={() => update({ ...snapshot })}>
                Retry save
              </button>
            </p>
          )}
          {download && (
            <section className="download-status">
              <progress max={download.total} value={download.received} />
              <p role="status">
                {download.phase === "complete"
                  ? "Download complete"
                  : `Downloading ${download.received} of ${download.total} bytes`}
              </p>
            </section>
          )}
          <StudentPlayer
            liveAvailable={liveAvailable}
            connectedAvailable={tutorAvailable}
            speechAvailable={speechAvailable}
            providerName={providerName}
            snapshot={snapshot}
            update={update}
            saved={saved}
          />
          {offline && (
            <button className="text-action" onClick={onReconnect}>
              Check school connection
            </button>
          )}
          <p className="helper-note" role="status">
            {offline
              ? "Progress stays on this device until you reconnect."
              : syncMessage}
          </p>
        </main>
      </div>
    </ConnectedTutorContext.Provider>
  );
}
