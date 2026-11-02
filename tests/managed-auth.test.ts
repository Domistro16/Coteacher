import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { SupabaseIdentity } from "../delivery/managed-auth";
import { emptySchoolState, SchoolService } from "../delivery/school-store";

const user = {
  id: "a5ee249e-f35b-4674-a192-05f1c6edabc1",
  aud: "authenticated",
  role: "authenticated",
  email: "fictional@invalid.example",
  email_confirmed_at: "2026-10-30T00:00:00Z",
  created_at: "2026-10-30T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: { coteacherRole: "owner", name: "Fictional owner" },
};
function tokens() {
  return {
    access_token: [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
          aal: "aal1",
          amr: [
            { method: "password", timestamp: Math.floor(Date.now() / 1000) },
          ],
        }),
      ).toString("base64url"),
      "mock-signature",
    ].join("."),
    refresh_token: "mock-refresh-token",
  };
}
function service() {
  let state = emptySchoolState();
  return new SchoolService({
    async transaction(work) {
      const next = structuredClone(state);
      const output = await work(next);
      state = next;
      return output;
    },
  });
}
describe("Supabase identity adapter (mock issuer; no external requests)", () => {
  it('supports declared adult self-signup without a guardian declaration and does not create guardian authority',async()=>{
    const calls:Record<string,any>[]=[];
    const request=(async(_input,init)=>{calls.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({user:{...user,user_metadata:{coteacherRole:'student',studentRegistrationRoute:'adult-self',adultSelfAuthorization:true}}}),{status:200,headers:{'Content-Type':'application/json'}});}) as typeof fetch;
    const auth=new SupabaseIdentity('https://fictional.supabase.co','fictional-key',[],request);
    expect((await auth.register({role:'student',name:'Fictional adult',email:'adult@fictional.invalid',password:'fictional-password',registrationAgeBand:'adult',adultSelfAuthorization:true},'https://student.fictional.invalid/')).confirmationRequired).toBe(true);
    expect(calls[0].data.studentRegistrationRoute).toBe('adult-self');expect(calls[0].data.guardianConsent).toBe(false);
    const school=service();const account=await school.managedAccount({id:'fictional-adult-provider',email:'adult@fictional.invalid',verified:true,role:'student',studentRegistrationRoute:'adult-self'});
    expect(account.guardianEmail).toBe('');expect(await school.repository.transaction(s=>s.consents.find(c=>c.accountId===account.id)?.kind)).toBe('adult-self');
  });
  it("requests recovery for a normalized email with the originating app callback", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const auth = new SupabaseIdentity("https://fictional.supabase.co", "fictional-key", [], request);
    const redirect = "http://127.0.0.1:5174/?auth=callback";
    expect((await auth.recover(" Fictional@invalid.example ", redirect)).message).toContain("If the account exists");
    expect(new URL(calls[0].url).pathname).toBe("/auth/v1/recover");
    expect(new URL(calls[0].url).searchParams.get("redirect_to")).toBe(redirect);
    expect(calls[0].body.email).toBe("fictional@invalid.example");
    for (const email of ["", "invalid", "fictional-school:pupil", "name@invalid.example\nBcc:elsewhere@invalid.example"])
      await expect(auth.recover(email, redirect)).rejects.toThrow("Enter an email address");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500])("does not claim recovery email delivery after issuer failure %s", async status => {
    const auth = new SupabaseIdentity("https://fictional.supabase.co", "fictional-key", [], vi.fn(async () =>
      new Response(JSON.stringify({ error_code: "email_delivery_failed", msg: "Delivery failed" }), {
        status, headers: { "Content-Type": "application/json" },
      })) as typeof fetch);
    await expect(auth.recover("fictional@invalid.example", "https://school.invalid/?auth=callback"))
      .rejects.toMatchObject({ status: status === 429 ? 429 : 503, message: status === 429
        ? "Please wait before requesting another recovery email."
        : "The recovery email could not be sent right now. Please try again later." });
  });
  it("explains an unconfirmed-email rejection without opening a session", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      error_code: "email_not_confirmed", msg: "Email not confirmed",
    }), {status:400,headers:{"Content-Type":"application/json"}})) as typeof fetch;
    const auth = new SupabaseIdentity("https://fictional.supabase.co", "fictional-key", [], request);
    const response = {setHeader:vi.fn()} as unknown as ServerResponse;
    await expect(auth.login({email:"fictional@invalid.example",password:"fictional-password"},response,service()))
      .rejects.toThrow("Confirm your email before signing in");
    expect(response.setHeader).not.toHaveBeenCalled();
  });
  it("resends through the issuer using the original app callback and normalizes email", async () => {
    const calls: {url:string;body:Record<string,unknown>}[]=[];
    const request = vi.fn(async (input:RequestInfo|URL,init?:RequestInit) => {
      calls.push({url:String(input),body:JSON.parse(String(init?.body))});
      return new Response("{}",{status:200,headers:{"Content-Type":"application/json"}});
    }) as typeof fetch;
    const auth = new SupabaseIdentity("https://fictional.supabase.co", "fictional-key", [], request);
    const redirect="http://127.0.0.1:5174/?auth=callback";
    expect((await auth.resend(" Fictional@invalid.example ",redirect)).message).toContain("If this account still needs confirmation");
    expect(new URL(calls[0].url).pathname).toBe("/auth/v1/resend");
    expect(new URL(calls[0].url).searchParams.get("redirect_to")).toBe(redirect);
    expect(calls[0].body).toMatchObject({type:"signup",email:"fictional@invalid.example"});
    await expect(auth.resend("fictional-school:pupil",redirect)).rejects.toThrow("School-issued usernames");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not claim a confirmation email was sent after issuer failure", async () => {
    const auth = new SupabaseIdentity("https://fictional.supabase.co", "fictional-key", [], vi.fn(async () =>
      new Response(JSON.stringify({error_code:"over_email_send_rate_limit",msg:"Rate limit"}),{status:429,headers:{"Content-Type":"application/json"}})) as typeof fetch);
    await expect(auth.resend("fictional@invalid.example","https://school.invalid/?auth=callback"))
      .rejects.toThrow("Please wait before requesting another confirmation email");
  });
  it("verifies identity through the issuer and sets secure HTTP-only cookies", async () => {
    const requests: string[] = [];
    const request = vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const auth = new SupabaseIdentity(
      "https://fictional.supabase.co",
      "fictional-publishable-key",
      [],
      request,
    );
    const headers: Record<string, unknown> = {};
    const response = {
      setHeader: (key: string, value: unknown) => {
        headers[key] = value;
      },
    } as unknown as ServerResponse;
    const account = await auth.callback(
      {
        accessToken: tokens().access_token,
        refreshToken: tokens().refresh_token,
      },
      response,
      service(),
    );
    expect(account.verified).toBe(true);
    expect(requests.some((url) => url.endsWith("/auth/v1/user"))).toBe(true);
    expect(headers["Set-Cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("HttpOnly; Secure; SameSite=Lax"),
      ]),
    );
    const cookie = (headers["Set-Cookie"] as string[])[0].split(";")[0];
    const checked = await auth.current(
      { headers: { cookie } } as IncomingMessage,
      response,
      service(),
    );
    expect(checked.account.email).toBe(user.email);
    expect(checked.mfa).toBe(false);
  });
  it("does not authorize an unverified email or issuer rejection", async () => {
    const request = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...user, email_confirmed_at: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as typeof fetch;
    const auth = new SupabaseIdentity(
      "https://fictional.supabase.co",
      "fictional-key",
      [],
      request,
    );
    const response = { setHeader: () => {} } as unknown as ServerResponse;
    await expect(
      auth.callback(
        { accessToken: tokens().access_token, refreshToken: "mock-refresh" },
        response,
        service(),
      ),
    ).rejects.toThrow("Verify your email");
    const denied = new SupabaseIdentity(
      "https://fictional.supabase.co",
      "fictional-key",
      [],
      vi.fn(
        async () =>
          new Response(JSON.stringify({ msg: "Invalid JWT" }), { status: 401 }),
      ) as typeof fetch,
    );
    await expect(
      denied.callback(
        { accessToken: tokens().access_token, refreshToken: "mock-refresh" },
        response,
        service(),
      ),
    ).rejects.toThrow("expired");
  });
  it("requires guardian authorization and never permits self-selected operator privileges", async () => {
    const request = vi.fn(
      async () =>
        new Response(JSON.stringify({ user }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as typeof fetch;
    const auth = new SupabaseIdentity(
      "https://fictional.supabase.co",
      "fictional-key",
      [],
      request,
    );
    await expect(
      auth.register(
        {
          role: "student",
          name: "Fictional child",
          email: "guardian@invalid.example",
          password: "fictional-password",
        },
        "https://school.invalid/",
      ),
    ).rejects.toThrow("guardian");
    await expect(
      auth.register(
        {
          role: "operator",
          name: "Fictional attacker",
          email: "fake@invalid.example",
          password: "fictional-password",
        },
        "https://school.invalid/",
      ),
    ).rejects.toThrow("Choose a role");
    expect(request).not.toHaveBeenCalled();
  });
});
