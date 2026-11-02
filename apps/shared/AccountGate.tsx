import { useEffect, useState, type ReactNode } from "react";
import { Brand, Icon, LearningArt } from "../student/src/student-ui";
import {
  accountApi as api,
  defaultConfig,
  type AccountConfig,
  type AccountSnapshot,
} from "./account-api";

export function AccountGate({
  kind,
  children,
}: {
  kind: "school" | "teacher" | "student";
  children: (
    state: AccountSnapshot,
    refresh: () => Promise<void>,
    config: AccountConfig,
  ) => ReactNode;
}) {
  const [state, setState] = useState<AccountSnapshot>();
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<
    "login" | "register" | "recover" | "password"
  >("login");
  const [registrationAge,setRegistrationAge]=useState<'unknown'|'adult'|'under-18'>('unknown');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [factor, setFactor] = useState<{
    id: string;
    totp?: { qr_code: string; secret: string };
  }>();
  const [factors, setFactors] = useState<
    { id: string; friendly_name?: string }[]
  >([]);
  const refresh = async () => setState(await api("me"));
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const next = await api("config");
        if (active) setConfig(next);
        const fragment = new URLSearchParams(location.hash.slice(1));
        if (fragment.has("access_token") && fragment.has("refresh_token")) {
          await api("auth/callback", {
            accessToken: fragment.get("access_token"),
            refreshToken: fragment.get("refresh_token"),
          });
          const recovery = fragment.get("type") === "recovery";
          history.replaceState(null, "", location.pathname + location.search);
          if (active && recovery) setMode("password");
        }
        const me: AccountSnapshot = await api("me");
        if (active) setState(me);
      } catch {
        /* A missing session opens sign-in. */
      } finally {
        if (active) setLoading(false);
      }
    }
    void start();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (state?.mfaRequired)
      void api("auth/mfa/factors", {})
        .then((x) => setFactors(x?.totp ?? []))
        .catch((e) => setError(e.message));
  }, [state?.mfaRequired]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [invite, setInvite] = useState(
    new URLSearchParams(location.search).get("invite") ?? "",
  );
  const role = kind === "school" ? "owner" : kind;
  const changePassword = state?.mustChangePassword || mode === "password";
  if (loading)
    return (
      <main className="student-app auth-page">
        <Brand />
        <p role="status">Opening your workspace…</p>
      </main>
    );
  if (state && !state.mfaRequired && !changePassword) {
    if (
      (kind === "student" && state.account.role !== "student") ||
      (kind === "teacher" && state.account.role === "student")
    )
      return (
        <main className="student-app auth-page">
          <Brand />
          <section className="auth-card">
            <h1>Open your own workspace.</h1>
            <p>
              This account uses the{" "}
              {state.account.role === "student"
                ? "student"
                : "teacher or school"}{" "}
              workspace.
            </p>
            <a
              href={
                state.account.role === "student"
                  ? config.studentUrl
                  : state.account.role === "owner" ||
                      state.account.role === "operator"
                    ? config.schoolUrl
                    : config.teacherUrl
              }
            >
              Continue to your workspace
            </a>
            <AccountSettings state={state} config={config} />
          </section>
        </main>
      );
    if (invite)
      return (
        <main className="student-app auth-page">
          <Brand />
          <section className="auth-card">
            <h1>You have a school invitation.</h1>
            <p>Accept it to connect this account with the inviting school.</p>
            {error && <p role="alert">{error}</p>}
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("school/accept-invite", { token: invite });
                  setInvite("");
                  history.replaceState(null, "", location.pathname);
                  await refresh();
                })
              }
            >
              Accept school invitation
            </button>
            <button onClick={() => setInvite("")}>Decide later</button>
          </section>
        </main>
      );
    if (
      kind === "school" &&
      !["owner", "operator"].includes(state.account.role) &&
      !state.memberships.some(
        (m) => ["owner", "admin"].includes(m.role) && m.status === "active",
      )
    )
      return (
        <main className="student-app auth-page">
          <Brand />
          <h1>Your account is ready.</h1>
          <p>Your school administrator manages school access.</p>
          <a
            className="primary"
            href={
              state.account.role === "teacher"
                ? config.teacherUrl
                : config.studentUrl
            }
          >
            Open your workspace
          </a>
          <AccountSettings state={state} config={config} />
        </main>
      );
    return children(state, refresh, config);
  }
  return (
    <main className="student-app auth-page">
      <header className="auth-header">
        <Brand />
        <span className="auth-tag">
          Your{" "}
          {kind === "school"
            ? "school, connected"
            : kind === "teacher"
              ? "teaching, carried forward"
              : "lesson. Your pace"}
          .
        </span>
      </header>
      <div className="auth-layout">
        <section className="auth-art">
          <span className="hero-pill">
            <Icon name="spark" size={16} />
            Another chance at the lesson
          </span>
          <h1>
            {kind === "school" ? (
              <>
                Great schools.
                <br />
                Connected classrooms.
              </>
            ) : kind === "teacher" ? (
              <>
                Teach once.
                <br />
                Reach further.
              </>
            ) : (
              <>
                Big ideas start
                <br />
                with a little curiosity.
              </>
            )}
          </h1>
          <LearningArt />
          <p>One classroom. More ways to understand.</p>
        </section>
        <section className="auth-card">
          <p className="eyebrow">{kind.toUpperCase()} WORKSPACE</p>
          <h1>
            {state?.mfaRequired
              ? "Protect your school."
              : changePassword
                ? "Set a new password."
                : mode === "register"
                  ? kind === "school"
                    ? "Bring your school together."
                    : "Create your account."
                  : mode === "recover"
                    ? "Let’s get you back in."
                    : "Welcome back."}
          </h1>
          {config.simulated && (
            <span className="status-pill">Simulated accounts only</span>
          )}
          {error && (
            <p className="app-alert" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {state?.mfaRequired ? (
            <>
              <p>Use an authenticator app to protect school administration.</p>
              {!factor && !factors.length && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => setFactor(await api("auth/mfa/enroll", {})))
                  }
                >
                  Set up authenticator
                </button>
              )}
              {factor?.totp && (
                <>
                  <img
                    style={{ maxWidth: 220 }}
                    src={factor.totp.qr_code}
                    alt="Scan this QR code in your authenticator app"
                  />
                  <details>
                    <summary>Enter setup key manually</summary>
                    <code>{factor.totp.secret}</code>
                  </details>
                </>
              )}
              {(factor || factors.length > 0) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const values = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    void run(async () => {
                      await api("auth/mfa/verify", {
                        factorId: factor?.id ?? factors[0].id,
                        code: values.code,
                      });
                      await refresh();
                    });
                  }}
                >
                  <label>
                    Authenticator code
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Verify code
                  </button>
                </form>
              )}
            </>
          ) : changePassword ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                void run(async () => {
                  await api(
                    state?.mustChangePassword
                      ? "school/change-password"
                      : "auth/password",
                    data,
                  );
                  setState(undefined);
                  setMode("login");
                  setNotice(
                    "Password changed. Sign in with your new password.",
                  );
                });
              }}
            >
              {state?.mustChangePassword && (
                <label>
                  Initial password
                  <input name="previous" type="password" required />
                </label>
              )}
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={2000}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="primary" disabled={busy}>
                Save new password
              </button>
            </form>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  void run(async () => {
                    if (mode === "recover") {
                      const result = await api("auth/recover", data);
                      setNotice(result.message);
                      return;
                    }
                    if (mode === "register") {
                      if(kind==='student' && registrationAge==='unknown'){setError('Answer the age question first.');return;}
                      const result = await api("register", {
                        ...data,
                        role,
                        simulated: config.simulated,
                        guardianConsent: data.guardianConsent === "true",
                        ...(kind==='student'?{registrationAgeBand:registrationAge,adultSelfAuthorization:data.adultSelfAuthorization==='true'}:{}),
                      });
                      if (result.confirmationRequired) {
                        setMode("login");
                        setNotice(result.message);
                        return;
                      }
                    }
                    await api("login", data);
                    await refresh();
                  });
                }}
              >
                {mode==='register' && kind==='student' && registrationAge==='unknown'?<fieldset><legend>Are you under 18?</legend><p>We store an age band, never your date of birth. Choose this before sharing the remaining details.</p><button type="button" onClick={()=>setRegistrationAge('under-18')}>Yes, under 18</button><button type="button" onClick={()=>setRegistrationAge('adult')}>No, 18 or older</button></fieldset>:<>
                {mode==='register' && kind==='student' && <p>{registrationAge==='adult'?'Adult self-signup':'Guardian-assisted signup'} <button type="button" onClick={()=>setRegistrationAge('unknown')}>Change age answer</button></p>}
                {mode === "register" && (
                  <label>
                    {kind === "student" ? "Student display name" : "Your name"}
                    <input
                      name="name"
                      required
                      maxLength={100}
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  {mode === "register" && kind === "student"
                    ? registrationAge==='adult'?'Your email':"Guardian email"
                    : "Email or school-issued username"}
                  <input
                    name="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                  />
                </label>
                {mode !== "recover" && (
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      minLength={mode === "register" ? 12 : 1}
                      maxLength={2000}
                      required
                      autoComplete={
                        mode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                    />
                  </label>
                )}
                {mode === "register" && kind === "student" && registrationAge==='under-18' && (
                  <label className="consent-row">
                    <input
                      type="checkbox"
                      name="guardianConsent"
                      value="true"
                      required
                    />
                    I am the student’s guardian and authorize this account. I
                    understand their school can review learning progress and
                    questions.
                  </label>
                )}
                {mode==='register' && kind==='student' && registrationAge==='adult' && <label className="consent-row"><input type="checkbox" name="adultSelfAuthorization" value="true" required/>I am registering my own adult account and authorize essential account processing.</label>}
                {mode==='register' && kind==='student' && registrationAge==='under-18' && <p>Guardian mailbox verification and independent relationship review follow sign-in. This checkbox is an initial declaration only.</p>}
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "register"
                      ? "Create account"
                      : mode === "recover"
                        ? "Send recovery link"
                        : "Sign in"}
                  <Icon name="arrow" size={18} />
                </button>
                {config.managed && mode === "login" && (
                  <button
                    type="button"
                    className="text-action"
                    disabled={busy}
                    onClick={(event) => {
                      const email = event.currentTarget.form!.elements.namedItem("email") as HTMLInputElement;
                      if (!email.reportValidity()) return;
                      void run(async () => {
                        const result = await api("auth/resend", { email: email.value, role });
                        setNotice(result.message);
                      });
                    }}
                  >
                    Resend confirmation email
                  </button>
                )}
                </>}
              </form>
              <button
                className="text-action"
                onClick={() => {
                  setMode(mode === "register" ? "login" : "register");
                  setError("");
                }}
              >
                {mode === "register"
                  ? "Already registered? Sign in"
                  : "Create an account"}
              </button>
              <button
                className="text-action"
                onClick={() => {
                  setMode(mode === "recover" ? "login" : "recover");
                  setError("");
                }}
              >
                {mode === "recover"
                  ? "Back to sign in"
                  : "Forgot your password?"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export function AccountSettings({
  state,
  config,
}: {
  state: AccountSnapshot;
  config: AccountConfig;
}) {
  const [notice, setNotice] = useState("");
  const [signingOut,setSigningOut]=useState(false);
  return (
    <section className="content-card">
      <h2>Your account</h2>
      <p>
        {state.account.name} · {state.account.email}
      </p>
      <p>
        Your device PIN protects downloaded learning separately from your
        account password.
      </p>
      {state.account.email.includes(":") && (
        <p>
          Ask your issuing school administrator to reset your school-issued
          password.
        </p>
      )}
      {config.managed && !state.account.email.includes(":") && (
        <button
          onClick={async () => {
            try {
              const result = await api("auth/recover", {
                email: state.account.email,
              });
              setNotice(result.message);
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
        >
          Send password recovery email
        </button>
      )}
      <button
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);setNotice('');
          try{await api("logout", {});location.assign(location.pathname);}
          catch(e){setNotice((e as Error).message);setSigningOut(false);}
        }}
      >
        Sign out
      </button>
      <p role="status">{notice}</p>
    </section>
  );
}
