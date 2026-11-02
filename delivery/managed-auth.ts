import {
  createClient,
  type SupabaseClient,
  type Session,
  type User,
} from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { SchoolError, type SchoolService } from "./school-store";

const cookieName = "__Host-coteacher_auth";
export class SupabaseIdentity {
  constructor(
    private url: string,
    private key: string,
    private operators: string[] = [],
    private request: typeof fetch = fetch,
  ) {
    if (!url.startsWith("https://") || !key)
      throw new Error("Configure HTTPS Supabase URL and publishable key.");
  }
  private client() {
    return createClient(this.url, this.key, {
      global: { fetch: this.request },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  private save(response: ServerResponse, session: Session | null) {
    const value = session
      ? Buffer.from(
          JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        ).toString("base64url")
      : "";
    response.setHeader("Set-Cookie", [
      `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session ? 604800 : 0}`,
      "coteacher_school=; Path=/api/v1; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    ]);
  }
  async current(
    request: IncomingMessage,
    response: ServerResponse,
    service: SchoolService,
  ) {
    const raw = request.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!raw || raw.length > 12000)
      throw new SchoolError(401, "Sign in to continue.");
    let tokens: { access_token: string; refresh_token: string };
    try {
      tokens = JSON.parse(Buffer.from(raw, "base64url").toString());
    } catch {
      throw new SchoolError(401, "Sign in again.");
    }
    const client = this.client();
    const session = await client.auth.setSession(tokens);
    if (session.error || !session.data.session) {
      this.save(response, null);
      throw new SchoolError(401, "Sign in again.");
    }
    // Never authorize using the cookie's decoded user. Revalidate with the issuer.
    const verified = await client.auth.getUser(
      session.data.session.access_token,
    );
    if (verified.error || !verified.data.user)
      throw new SchoolError(401, "Sign in again.");
    this.save(response, session.data.session);
    const account = await this.account(service, verified.data.user);
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return {
      actor: account.id,
      account,
      client,
      mfa: assurance.data?.currentLevel === "aal2",
      studentAgeBand:verified.data.user.user_metadata.studentRegistrationRoute==='adult-self'?'adult' as const:verified.data.user.user_metadata.studentRegistrationRoute==='guardian-assisted'?'under-18' as const:undefined,
    };
  }
  private account(service: SchoolService, user: User) {
    if (
      user.user_metadata.coteacherRole === "student" &&
      user.user_metadata.guardianConsent !== true && !(user.user_metadata.studentRegistrationRoute==='adult-self' && user.user_metadata.adultSelfAuthorization===true)
    )
      throw new SchoolError(
        403,
        "Guardian authorization is required for this student account.",
      );
    return service.managedAccount(
      {
        id: user.id,
        email: user.email ?? "",
        verified: !!user.email_confirmed_at,
        role: user.user_metadata.coteacherRole,
        name: user.user_metadata.name,
        studentRegistrationRoute:user.user_metadata.studentRegistrationRoute,
      },
      this.operators,
    );
  }
  async register(data: Record<string, unknown>, redirectTo: string) {
    if(data.role==='student' && data.registrationAgeBand!==undefined && !['adult','under-18'].includes(String(data.registrationAgeBand)))throw new SchoolError(400,'Choose a valid age band.');
    if (
      !["owner", "teacher", "student"].includes(String(data.role)) ||
      typeof data.name !== "string" ||
      data.name.length > 100 ||
      typeof data.email !== "string" ||
      typeof data.password !== "string" ||
      data.password.length < 12 ||
      data.password.length > 2000
    )
      throw new SchoolError(
        400,
        "Choose a role, name, valid email and password of at least 12 characters.",
      );
    if (data.role === "student" && data.guardianConsent !== true && !(data.registrationAgeBand==='adult' && data.adultSelfAuthorization===true))
      throw new SchoolError(
        400,
        "A guardian must create and authorize this student account using their email.",
      );
    const { error } = await this.client().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          coteacherRole: data.role,
          name: data.name,
          guardianConsent: data.guardianConsent === true,
          ...(data.role==='student' && data.registrationAgeBand!==undefined?{studentRegistrationRoute:data.registrationAgeBand==='adult'?'adult-self':'guardian-assisted',adultSelfAuthorization:data.registrationAgeBand==='adult' && data.adultSelfAuthorization===true}:{}),
        },
      },
    });
    if (error)
      throw new SchoolError(
        400,
        "Registration could not be completed. Check your details or try account recovery.",
      );
    return {
      confirmationRequired: true,
      message: "Check your email to verify your account, then sign in.",
    };
  }
  async login(
    data: Record<string, unknown>,
    response: ServerResponse,
    service: SchoolService,
  ) {
    if (typeof data.email !== "string" || typeof data.password !== "string")
      throw new SchoolError(400, "Email and password required.");
    const client = this.client();
    const result = await client.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });
    if (result.error?.code === "email_not_confirmed")
      throw new SchoolError(
        401,
        "Confirm your email before signing in. Check your inbox and spam folder, or resend the confirmation email.",
      );
    if (result.error || !result.data.session)
      throw new SchoolError(
        401,
        "Sign-in failed. Verify your email or use account recovery.",
      );
    const account = await this.account(service, result.data.user);
    this.save(response, result.data.session);
    return account;
  }
  async resend(email: unknown, redirectTo: string) {
    if (typeof email !== "string" || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.includes(":"))
      throw new SchoolError(400, "Enter the email address used to create your account. School-issued usernames do not use email confirmation.");
    const { error } = await this.client().auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error)
      throw new SchoolError(
        error.status === 429 ? 429 : 503,
        error.status === 429
          ? "Please wait before requesting another confirmation email."
          : "The confirmation email could not be sent right now. Please try again later.",
      );
    return { message: "If this account still needs confirmation, a new email has been sent. Check your inbox and spam folder." };
  }
  async callback(
    data: Record<string, unknown>,
    response: ServerResponse,
    service: SchoolService,
  ) {
    if (
      typeof data.accessToken !== "string" ||
      typeof data.refreshToken !== "string"
    )
      throw new SchoolError(400, "Invalid verification link.");
    const client = this.client();
    const session = await client.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });
    if (session.error || !session.data.session)
      throw new SchoolError(401, "Verification link expired.");
    const checked = await client.auth.getUser();
    if (checked.error || !checked.data.user)
      throw new SchoolError(401, "Verification failed.");
    const account = await this.account(service, checked.data.user);
    this.save(response, session.data.session);
    return account;
  }
  async recover(email: unknown, redirectTo: string) {
    if (typeof email !== "string" || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.includes(":"))
      throw new SchoolError(400, "Enter an email address.");
    const { error } = await this.client().auth.resetPasswordForEmail(
      email.trim().toLowerCase(), { redirectTo },
    );
    if (error)
      throw new SchoolError(
        error.status === 429 ? 429 : 503,
        error.status === 429
          ? "Please wait before requesting another recovery email."
          : "The recovery email could not be sent right now. Please try again later.",
      );
    return { message: "If the account exists, a recovery link has been sent." };
  }
  async logout(client: SupabaseClient, response: ServerResponse) {
    await client.auth.signOut();
    this.save(response, null);
  }
}
