import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { schoolHttp, type SchoolHttpOptions } from "../delivery/school-http";
import type { SupabaseIdentity } from "../delivery/managed-auth";
import { SchoolService, emptySchoolState } from "../delivery/school-store";
import { LearnerService } from '../delivery/learner-service';

function setup(options: SchoolHttpOptions = {}) {
  let state = emptySchoolState();
  const service = new SchoolService({
    async transaction(work) {
      const next = structuredClone(state);
      const output = await work(next);
      state = next;
      return output;
    },
  });
  options.learners ??= new LearnerService(service,'fictional-http-profile-key-123456789');
  const handle = schoolHttp(service, options);
  return async (
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
    method = data === undefined ? "GET" : "POST",
  ) => {
    const request = Object.assign(
      Readable.from(
        data === undefined ? [] : [Buffer.from(JSON.stringify(data))],
      ),
      {
        url: "/api/v1/" + path,
        method,
        headers: {
          host: "localhost:8787",
          "content-type": "application/json",
          ...headers,
        },
        socket: { remoteAddress: "127.0.0.1" },
      },
    ) as unknown as IncomingMessage;
    let status = 0,
      body = "";
    const outputHeaders: Record<string, unknown> = {};
    const response = {
      getHeader(key: string) {
        return outputHeaders[key];
      },
      setHeader(key: string, value: unknown) {
        outputHeaders[key] = value;
      },
      writeHead(code: number, values: Record<string, unknown>) {
        status = code;
        Object.assign(outputHeaders, values);
      },
      end(value: string) {
        body = value;
      },
    } as unknown as ServerResponse;
    await handle(request, response);
    return { status, headers: outputHeaders, body: JSON.parse(body) };
  };
}
afterEach(() => vi.unstubAllEnvs());
describe("school HTTP authentication boundaries (in-process transport)", () => {
  it('protects improvement withdrawal and exposes no training collection/export endpoint',async()=>{
    const request=setup();expect((await request('learner/improvement/withdraw',{})).status).toBe(401);
    await request('register',{email:'improvement@fictional.invalid',name:'Fictional learner',role:'student',password:'fictional-password',simulated:true});
    const login=await request('login',{email:'improvement@fictional.invalid',password:'fictional-password'}),cookie=String(login.headers['Set-Cookie']).split(';')[0];
    const withdrawn=await request('learner/improvement/withdraw',{}, {cookie});expect(withdrawn.status).toBe(200);expect(withdrawn.headers['Cache-Control']).toBe('no-store');expect(withdrawn.body.improvementDataAllowed).toBe(false);
    expect((await request('learner/training-events',{}, {cookie})).status).toBe(404);expect((await request('learner/training-export',undefined,{cookie})).status).toBe(404);
    expect((await request('learner/profile',{revision:withdrawn.body.revision,trainingEvents:[]},{cookie})).status).toBe(400);
  });
  it('keeps profile routes authenticated and guardian token routes narrow',async()=>{
    const request=setup();
    expect((await request('learner/profile')).status).toBe(401);
    await request('register',{email:'profile@fictional.invalid',name:'Fictional learner',role:'student',password:'fictional-password',simulated:true});
    const login=await request('login',{email:'profile@fictional.invalid',password:'fictional-password'});
    const cookie=String(login.headers['Set-Cookie']).split(';')[0];
    expect((await request('learner/profile',undefined,{cookie})).body.ageBand).toBe('unknown');
    expect((await request('learner/profile',{revision:0,ageBand:'under-18'},{cookie})).status).toBe(200);
    const r=await request('learner/guardian',{email:'guardian@fictional.invalid',scopes:{essential:true,personalization:false,externalAI:false}},{cookie});
    expect(r.status).toBe(201);
    const token=r.body.verificationToken;
    expect((await request('guardian/details',{token})).body.scopes.personalization).toBe(false);
    expect((await request('guardian/verify',{token,authorityDeclared:true},{origin:'https://foreign.invalid'})).status).toBe(403);
    expect((await request('guardian/verify',{token,authorityDeclared:true})).status).toBe(200);
    expect((await request('guardian/verify',{token,authorityDeclared:true})).status).toBe(410);
    expect((await request('guardian/reviews')).status).toBe(401);
    expect(JSON.stringify((await request('me',undefined,{cookie})).body)).not.toContain('privateLearners');
  });
  it("allows signed-out confirmation resend only through the approved app origin", async () => {
    const resend=vi.fn(async()=>({message:"If confirmation is needed, an email was sent."}));
    const request=setup({identity:{resend} as unknown as SupabaseIdentity,origins:["https://teacher.invalid"]});
    const response=await request("auth/resend",{email:"fictional@invalid.example"},{origin:"https://teacher.invalid"});
    expect(response.status).toBe(200);
    expect(resend).toHaveBeenCalledWith("fictional@invalid.example","https://teacher.invalid/?auth=callback");
    expect((await request("auth/resend",{email:"fictional@invalid.example"},{origin:"https://foreign.invalid"})).status).toBe(403);
    expect(resend).toHaveBeenCalledTimes(1);
  });
  it("rejects an old local adult session after public identity is enabled", async () => {
    const options: SchoolHttpOptions = {};
    const request = setup(options);
    await request("register", {email:"fictional-local@invalid",name:"Fictional teacher",role:"teacher",password:"fictional-password",simulated:true});
    const login = await request("login", {email:"fictional-local@invalid",password:"fictional-password"});
    const cookie = String(login.headers["Set-Cookie"]).split(";")[0];
    options.identity = {} as SupabaseIdentity;
    vi.stubEnv("COTEACHER_PUBLIC", "true");
    expect((await request("me", undefined, {cookie})).status).toBe(403);
  });
  it("directs school-issued credential recovery to the issuing school", async () => {
    const response = await setup()("auth/recover", {
      email: "fictional-school:pupil",
    });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("issuing school administrator");
  });
  it("does not let changing cookies reset anonymous sign-in limits", async () => {
    const request = setup();
    for (let attempt = 0; attempt < 240; attempt++) {
      expect(
        (await request("login", {}, { cookie: "untrusted=" + attempt })).status,
      ).toBe(400);
    }
    expect(
      (await request("login", {}, { cookie: "untrusted=another" })).status,
    ).toBe(429);
    expect(
      (await request("auth/resend", {email:"fictional@invalid.example"}, {cookie:"untrusted=resend"})).status,
    ).toBe(429);
  });
  it("sets HTTP-only local session cookies, requires login and revokes logout", async () => {
    const request = setup();
    expect((await request("me")).status).toBe(401);
    expect(
      (
        await request("register", {
          email: "fictional@invalid",
          name: "Fictional teacher",
          password: "fictional-password",
          role: "teacher",
          simulated: true,
        })
      ).status,
    ).toBe(201);
    const login = await request("login", {
      email: "fictional@invalid",
      password: "fictional-password",
    });
    expect(login.status).toBe(200);
    expect(login.headers["Set-Cookie"]).toContain("HttpOnly; SameSite=Strict");
    const cookie = String(login.headers["Set-Cookie"]).split(";")[0];
    expect((await request("me", undefined, { cookie })).body.account.role).toBe(
      "teacher",
    );
    expect((await request("logout", {}, { cookie })).status).toBe(200);
    expect((await request("me", undefined, { cookie })).status).toBe(401);
  });
  it("rejects cross-origin writes and unrecognized methods", async () => {
    const request = setup();
    expect(
      (await request("register", {}, { origin: "https://attacker.invalid" }))
        .status,
    ).toBe(403);
    expect(
      (await request("register", {}, { "sec-fetch-site": "cross-site" }))
        .status,
    ).toBe(403);
    expect((await request("register", {}, {}, "DELETE")).status).toBe(405);
    expect(
      (await request("register", {}, { "content-type": "text/plain" })).status,
    ).toBe(415);
  });
  it("fails closed in public mode instead of using fictional identities", async () => {
    vi.stubEnv("COTEACHER_PUBLIC", "true");
    const request = setup();
    expect((await request("register", {})).status).toBe(503);
  });
});
