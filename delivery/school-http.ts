import type { SchoolTutor } from "./school-tutor";
import type { LearnerService } from "./learner-service";
import type { PreparationService } from './preparation-service';
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { SchoolError, SchoolService } from "./school-store";
import type { SupabaseIdentity } from "./managed-auth";
import type { SchoolLessons } from "./school-lessons";

export interface SchoolHttpOptions {
  identity?: SupabaseIdentity;
  lessons?: SchoolLessons;
  tutor?: SchoolTutor;
  learners?: LearnerService;
  preparation?: PreparationService;
  origins?: string[];
  schoolUrl?: string;
  teacherUrl?: string;
  studentUrl?: string;
}
export function schoolHttp(
  service: SchoolService,
  options: SchoolHttpOptions = {},
) {
  const attempts = new Map<string, { count: number; until: number }>();
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (!path.startsWith("/api/v1/")) return false;
    const send = (status: number, value: unknown) => {
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(JSON.stringify(value));
    };
    try {
      const publicMode = process.env.COTEACHER_PUBLIC === "true";
      if (publicMode && !options.identity)
        throw new SchoolError(503, "Managed identity is not configured.");
      if (request.method === "GET" && path === "/api/v1/config") {
        send(200, {
          managed: !!options.identity,
          connectedTutor: !!options.tutor?.provider,
          liveVoice: !!options.tutor?.liveAvailable,
          connectedSpeech: !!options.tutor?.provider && options.tutor.provider.engine!=='llama.cpp',
          textProvider: options.tutor?.provider?.engine??'unavailable',
          simulated: process.env.COTEACHER_ALLOW_REAL_STUDENTS !== "true",
          schoolUrl: options.schoolUrl ?? "http://127.0.0.1:5175",
          teacherUrl: options.teacherUrl ?? "http://127.0.0.1:5174",
          studentUrl: options.studentUrl ?? "http://127.0.0.1:5173",
        });
        return true;
      }
      const ip = request.socket.remoteAddress ?? "";
      const authentication = [
        "/api/v1/login",
        "/api/v1/register",
        "/api/v1/auth/recover",
        "/api/v1/auth/resend",
        "/api/v1/auth/callback",
        "/api/v1/guardian/verify",
        "/api/v1/guardian/details",
      ].includes(path);
      // Anonymous authentication must not get a fresh allowance by changing a cookie.
      const rateKey =
        !authentication && request.headers.cookie
          ? createHash("sha256").update(request.headers.cookie).digest("hex")
          : ip;
      const now = Date.now();
      if (attempts.size > 10000)
        for (const [key, value] of attempts)
          if (value.until < now) attempts.delete(key);
      if (attempts.size >= 10001 && !attempts.has(rateKey))
        throw new SchoolError(429, "Too many requests. Retry shortly.");
      const bucket = attempts.get(rateKey);
      if (bucket && bucket.until > now) {
        if (++bucket.count > 240)
          throw new SchoolError(429, "Too many requests. Retry shortly.");
      } else attempts.set(rateKey, { count: 1, until: now + 60_000 });
      if (!["GET", "POST", "HEAD"].includes(request.method ?? ""))
        throw new SchoolError(405, "Method not allowed.");
      const token =
        /(?:^|;\s*)coteacher_school=([a-f0-9]{64})(?:;|$)/.exec(
          request.headers.cookie ?? "",
        )?.[1] ?? "";
      let data: Record<string, unknown> = {};
      const origin = request.headers.origin;
      if (request.method === "POST") {
        if (request.headers["sec-fetch-site"] === "cross-site")
          throw new SchoolError(403, "Cross-site requests are not accepted.");
        const allowed =
          origin &&
          (options.origins?.includes(origin) ||
            (!publicMode && new URL(origin).host === request.headers.host));
        if ((origin && !allowed) || (publicMode && !origin))
          throw new SchoolError(403, "Origin does not match.");
        if (!request.headers["content-type"]?.startsWith("application/json"))
          throw new SchoolError(415, "JSON required.");
        let length = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          length += chunk.length;
          if (
            length >
            (path === "/api/v1/lessons/publish"
              ? 48_000_000
              : path.includes("/progress")
                ? 5_000_000
                : path.includes("/tutor")
                  ? 4_000_000
                  : 32000)
          )
            throw new SchoolError(413, "Request too large.");
          chunks.push(chunk);
        }
        const input: unknown = JSON.parse(Buffer.concat(chunks).toString());
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new SchoolError(400, "Object required.");
        data = input as Record<string, unknown>;
      }
      const redirectTo =
        (origin && options.origins?.includes(origin)
          ? origin
          : (options.schoolUrl ?? "http://127.0.0.1:5175")) + "/?auth=callback";
      if (request.method === "POST" && path === "/api/v1/register") {
        if(!options.identity && data.role==='student' && options.learners && ['adult','under-18'].includes(String(data.registrationAgeBand))){
          const account=await service.register(data);await options.learners.initializeAge(account.id,data.registrationAgeBand as 'adult'|'under-18');send(201,account);return true;
        }
        send(
          201,
          options.identity
            ? await options.identity.register(data, redirectTo)
            : await service.register(data),
        );
        return true;
      }
      if (request.method === "POST" && path === "/api/v1/auth/recover") {
        if (typeof data.email === "string" && data.email.includes(":")) {
          send(200, {
            message:
              "Ask your issuing school administrator to reset your school-issued password.",
          });
          return true;
        }
        if (!options.identity)
          throw new SchoolError(
            503,
            "Email recovery requires managed identity. Ask the issuing school to reset school-issued credentials.",
          );
        send(200, await options.identity.recover(data.email, redirectTo));
        return true;
      }
      if (request.method === "POST" && path === "/api/v1/auth/resend") {
        if (!options.identity)
          throw new SchoolError(503, "Email confirmation requires managed identity.");
        send(200, await options.identity.resend(data.email, redirectTo));
        return true;
      }
      if (request.method === "POST" && path === "/api/v1/auth/callback") {
        if (!options.identity)
          throw new SchoolError(503, "Managed identity is unavailable.");
        send(200, await options.identity.callback(data, response, service));
        return true;
      }
      if (request.method === "POST" && path === "/api/v1/login") {
        if (
          typeof data.email !== "string" ||
          typeof data.password !== "string" ||
          data.password.length > 2000
        )
          throw new SchoolError(400, "Credentials required.");
        if (options.identity && !data.email.includes(":"))
          send(200, await options.identity.login(data, response, service));
        else {
          const login = await service.login(data.email, data.password);
          if (publicMode && login.account.role !== "student")
            throw new SchoolError(
              403,
              "Use managed sign-in for adult accounts.",
            );
          response.setHeader(
            "Set-Cookie",
            `coteacher_school=${login.token}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=28800${publicMode ? "; Secure" : ""}`,
          );
          send(200, login.account);
        }
        return true;
      }
      if (options.learners && path === '/api/v1/guardian/verify' && request.method === 'POST') {
        send(200, await options.learners.verifyGuardian(data));
        return true;
      }
      if (options.learners && path === '/api/v1/guardian/details' && request.method === 'POST') {
        send(200, await options.learners.guardianDetails(data)); return true;
      }
      const managed =
        options.identity && !token
          ? await options.identity.current(request, response, service)
          : undefined;
      const actor = managed?.actor ?? (await service.authenticate(token));
      if(options.learners && managed?.account.role==='student' && managed.account.simulated && managed.studentAgeBand)await options.learners.initializeAge(actor,managed.studentAgeBand);
      const snapshot = await service.snapshot(actor);
      if (publicMode && token && snapshot.account.role !== "student")
        throw new SchoolError(403, "Use managed sign-in for adult accounts.");
      const administrator =
        ["owner", "operator"].includes(snapshot.account.role) ||
        snapshot.memberships.some(
          (m) => m.status === "active" && ["owner", "admin"].includes(m.role),
        );
      if (path === "/api/v1/me" && request.method === "GET") {
        send(200, {
          ...snapshot,
          mfaRequired: !!options.identity && administrator && !managed?.mfa,
        });
        return true;
      }
      if (path === "/api/v1/logout" && request.method === "POST") {
        if (managed) await options.identity!.logout(managed.client, response);
        else await service.logout(token);
        response.setHeader("Set-Cookie", [
          ...(response.getHeader("Set-Cookie")
            ? Array.isArray(response.getHeader("Set-Cookie"))
              ? (response.getHeader("Set-Cookie") as string[])
              : [String(response.getHeader("Set-Cookie"))]
            : []),
          `coteacher_school=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0${publicMode ? "; Secure" : ""}`,
        ]);
        send(200, { ok: true });
        return true;
      }
      if (path.startsWith("/api/v1/auth/mfa/") && request.method === "POST") {
        if (!managed) throw new SchoolError(403, "Managed sign-in required.");
        const action = path.split("/").pop();
        if (action === "enroll") {
          const result = await managed.client.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "Coteacher authenticator",
          });
          if (result.error) throw new SchoolError(400, result.error.message);
          send(200, result.data);
        } else if (action === "factors") {
          const result = await managed.client.auth.mfa.listFactors();
          send(200, result.data);
        } else if (action === "verify") {
          if (
            typeof data.factorId !== "string" ||
            typeof data.code !== "string"
          )
            throw new SchoolError(400, "Authenticator code required.");
          const result = await managed.client.auth.mfa.challengeAndVerify({
            factorId: data.factorId,
            code: data.code,
          });
          if (result.error)
            throw new SchoolError(403, "Authenticator code was not accepted.");
          // Reissue the elevated session as an HTTP-only cookie.
          const elevated = await managed.client.auth.getSession();
          await options.identity!.callback(
            {
              accessToken: elevated.data.session?.access_token,
              refreshToken: elevated.data.session?.refresh_token,
            },
            response,
            service,
          );
          send(200, { ok: true });
        } else throw new SchoolError(404, "Unknown MFA operation.");
        return true;
      }
      if (path === "/api/v1/auth/password" && request.method === "POST") {
        if (
          !managed ||
          typeof data.password !== "string" ||
          data.password.length < 12
        )
          throw new SchoolError(
            400,
            "Managed sign-in and a password of at least 12 characters required.",
          );
        const result = await managed.client.auth.updateUser({
          password: data.password,
        });
        if (result.error)
          throw new SchoolError(400, "Password could not be changed.");
        await options.identity!.logout(managed.client, response);
        send(200, { ok: true });
        return true;
      }
      if (options.identity && administrator && !managed?.mfa)
        throw new SchoolError(
          403,
          "Set up and verify your authenticator before administering schools.",
        );
      if (options.learners) {
        if (path === '/api/v1/learner/profile') {
          if (!['GET','POST'].includes(request.method ?? '')) throw new SchoolError(405, 'Method not allowed.');
          send(200, request.method === 'GET' ? await options.learners.get(actor) : await options.learners.update(actor, data));
          return true;
        }
        if (path === '/api/v1/learner/withdraw' && request.method === 'POST') {
          send(200, await options.learners.withdraw(actor)); return true;
        }
        if (path === '/api/v1/learner/guardian' && request.method === 'POST') {
          send(201, await options.learners.requestGuardian(actor, data)); return true;
        }
        if (path === '/api/v1/guardian/reviews') {
          if (!['GET','POST'].includes(request.method ?? '')) throw new SchoolError(405, 'Method not allowed.');
          send(200, request.method === 'GET' ? await options.learners.reviews(actor) : await options.learners.review(actor, data)); return true;
        }
      }
      const preparedRoute=/^\/api\/v1\/lessons\/([a-f0-9-]{36})\/(preparation|learning)$/.exec(path);
      if(preparedRoute && options.preparation && options.lessons && options.learners){
        const publicationId=preparedRoute[1];
        if(preparedRoute[2]==='preparation'){
          if(request.method==='GET')send(200,await options.preparation.current(actor,publicationId,true));
          else if(request.method==='POST')send(200,data.action==='approve'?await options.preparation.approve(actor,publicationId,data):data.action==='generate'?await options.preparation.generate(actor,publicationId):await options.preparation.draft(actor,publicationId));
          else throw new SchoolError(405,'Method not allowed.');
        }else{
          const support=await options.preparation.current(actor,publicationId);
          if(request.method==='GET')send(200,{memory:await options.learners.learningContext(actor),support});
          else if(request.method==='POST' && support){
            const lesson=await options.lessons.package(actor,publicationId);
            const progress=await options.lessons.returnedProgress(actor,publicationId);
            if(!progress)throw new SchoolError(409,'Synchronize lesson progress before completion.');
            send(200,await options.learners.observe(actor,lesson,progress,support.knowledge,data.completed===true,undefined,data.promptDismissed===true));
          }else throw new SchoolError(409,'Teacher-reviewed support is not available.');
        }
        return true;
      }
      if (options.tutor) {
        const tutor =
          /^\/api\/v1\/lessons\/([a-f0-9-]{36})\/tutor(?:\/(voice|live|check|consent))?$/.exec(
            path,
          );
        if (tutor) {
          if (
            request.method !== "POST" &&
            !(request.method === "GET" && !tutor[2])
          )
            throw new SchoolError(405, "Method not allowed.");
          const operation =
            request.method === "GET" ? "current" : (tutor[2] ?? "submit");
          send(
            200,
            await options.tutor.request(
              actor,
              tutor[1],
              operation,
              request.method === "POST" ? data : undefined,
              new URL(request.url ?? "/", "http://localhost").searchParams.get(
                "speech",
              ) === "defer",
            ),
          );
          return true;
        }
        const oversight =
          /^\/api\/v1\/teaching\/([a-f0-9-]{36})\/tutor(?:\/flag)?$/.exec(path);
        if (oversight) {
          if (request.method === "GET")
            send(200, await options.tutor.overview(actor, oversight[1]));
          else if (request.method === "POST" && path.endsWith("/flag"))
            send(
              200,
              await options.tutor.overview(actor, oversight[1], {
                studentId: String(data.studentId ?? ""),
                lessonId: String(data.lessonId ?? ""),
                questionId: String(data.questionId ?? ""),
              }),
            );
          else throw new SchoolError(405, "Method not allowed.");
          return true;
        }
      }
      if (options.lessons) {
        if (path === "/api/v1/uploads" && request.method === "POST") {
          send(
            201,
            await options.lessons.createUpload(
              actor,
              String(data.offeringId ?? ""),
              data.sha256,
              data.byteLength,
            ),
          );
          return true;
        }
        if (path === "/api/v1/lessons" && request.method === "GET") {
          send(200, await options.lessons.catalog(actor));
          return true;
        }
        if (path === "/api/v1/lessons/publish" && request.method === "POST") {
          send(
            201,
            await options.lessons.publish(
              actor,
              String(data.offeringId ?? ""),
              data.lesson,
              data.external === true,
              data.privacyReviewed === true,
              typeof data.uploadId === "string" ? data.uploadId : undefined,
            ),
          );
          return true;
        }
        const lesson =
          /^\/api\/v1\/lessons\/([a-f0-9-]{36})(\/progress)?$/.exec(path);
        if (lesson && request.method === "GET" && !lesson[2]) {
          send(200, await options.lessons.package(actor, lesson[1]));
          return true;
        }
        if (lesson?.[2] && request.method === "POST") {
          const receipt=await options.lessons.progress(actor, lesson[1], data);
          if(options.preparation && options.learners){
            const support=await options.preparation.current(actor,lesson[1]);
            if(support)await options.learners.observe(actor,await options.lessons.package(actor,lesson[1]),data as unknown as import('@coteacher/shared').ProgressRecord,support.knowledge);
          }
          send(200, receipt);
          return true;
        }
        if (lesson?.[2] && request.method === "GET") {
          send(200, await options.lessons.returnedProgress(actor, lesson[1]));
          return true;
        }
        const access = /^\/api\/v1\/teaching\/([a-f0-9-]{36})\/access$/.exec(
          path,
        );
        if (access && request.method === "GET") {
          if (!(await service.canTeach(actor, access[1])))
            throw new SchoolError(403, "Teaching assignment required.");
          send(200, { allowed: true });
          return true;
        }
        const answer = /^\/api\/v1\/lessons\/([a-f0-9-]{36})\/answers$/.exec(
          path,
        );
        if (answer && request.method === "POST") {
          send(
            200,
            await options.lessons.answer(
              actor,
              answer[1],
              String(data.studentId ?? ""),
              String(data.questionId ?? ""),
              data.answer,
              data.sourceRefs,
            ),
          );
          return true;
        }
        const records = /^\/api\/v1\/teaching\/([a-f0-9-]{36})\/progress$/.exec(
          path,
        );
        if (records && request.method === "GET") {
          send(200, await options.lessons.teacherRecords(actor, records[1]));
          return true;
        }
        const media =
          /^\/api\/v1\/media\/([a-f0-9]{64})\/([a-f0-9-]{36})$/.exec(path);
        if (media && ["GET", "HEAD"].includes(request.method ?? "")) {
          const bytes = await options.lessons.audio(actor, media[2], media[1]);
          let start = 0,
            end = bytes.length - 1,
            status = 200;
          if (request.headers.range) {
            const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
            if (!range || (!range[1] && !range[2]))
              throw new SchoolError(416, "Invalid range.");
            if (range[1]) {
              start = Number(range[1]);
              if (range[2]) end = Math.min(end, Number(range[2]));
            } else start = Math.max(0, bytes.length - Number(range[2]));
            if (
              !Number.isSafeInteger(start) ||
              !Number.isSafeInteger(end) ||
              start > end ||
              start >= bytes.length
            )
              throw new SchoolError(416, "Invalid range.");
            status = 206;
          }
          response.writeHead(status, {
            "Content-Type": "audio/ogg",
            "Content-Length": end - start + 1,
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
            ...(status === 206
              ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
              : {}),
          });
          response.end(
            request.method === "HEAD"
              ? undefined
              : bytes.subarray(start, end + 1),
          );
          return true;
        }
      }
      const command = /^\/api\/v1\/school\/([a-z-]+)$/.exec(path);
      if (!command || request.method !== "POST")
        throw new SchoolError(404, "Unknown endpoint.");
      send(200, await service.command(actor, command[1], data));
    } catch (e) {
      if (!response.headersSent)
        send(e instanceof SchoolError ? e.status : 400, {
          error:
            e instanceof SchoolError
              ? e.message
              : "The request could not be completed. Your saved work is unchanged.",
        });
      else response.destroy();
    }
    return true;
  };
}
