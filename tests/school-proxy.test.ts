import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable, Writable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import proxy from "../api/proxy";

class ResponseCapture extends Writable {
  statusCode = 200;
  headersSent = false;
  headers: Record<string, unknown> = {};
  chunks: Buffer[] = [];
  setHeader(name: string, value: unknown) {
    this.headers[name.toLowerCase()] = value;
  }
  writeHead(status: number, headers: Record<string, unknown> = {}) {
    this.statusCode = status;
    Object.entries(headers).forEach(([key, value]) =>
      this.setHeader(key, value),
    );
  }
  _write(chunk: Buffer, _encoding: string, done: () => void) {
    this.headersSent = true;
    this.chunks.push(Buffer.from(chunk));
    done();
  }
  get bytes() {
    return Buffer.concat(this.chunks);
  }
}
function request(path: string, method = "GET", body?: Buffer, headers = {}) {
  return Object.assign(Readable.from(body ? [body] : []), {
    url: "/api/proxy?path=" + path,
    method,
    headers,
  }) as IncomingMessage;
}
async function invoke(req: IncomingMessage) {
  const response = new ResponseCapture();
  await proxy(req, response as unknown as ServerResponse);
  return response;
}
afterEach(() => vi.unstubAllEnvs());

describe("same-origin school deployment proxy (mock upstream)", () => {
  it("routes original API URLs without letting query parameters change their destination", async () => {
    vi.stubEnv("COTEACHER_BACKEND_URL", "https://fictional-backend.invalid");
    const upstream = vi.fn(async (_target: URL) => new Response("{}"));
    vi.stubGlobal("fetch", upstream);
    const original = request("ignored");
    original.url = "/api/v1/lessons/fictional/tutor?speech=defer&path=health";
    await invoke(original);
    expect(upstream.mock.calls[0][0].href).toBe(
      "https://fictional-backend.invalid/api/v1/lessons/fictional/tutor?speech=defer",
    );
  });
  it("preserves login bodies, origin checks and separate secure cookies", async () => {
    vi.stubEnv("COTEACHER_BACKEND_URL", "https://fictional-backend.invalid");
    const upstream = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              "__Host-coteacher_auth=fictional; HttpOnly; Secure; Path=/",
          },
        }),
    );
    vi.stubGlobal("fetch", upstream);
    const body = Buffer.from(
      '{"email":"fictional@invalid.example","password":"fictional"}',
    );
    const response = await invoke(
      request("v1/login", "POST", body, {
        origin: "https://school.invalid",
        cookie: "session=fictional",
        "content-type": "application/json",
      }),
    );
    const [url, options] = upstream.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://fictional-backend.invalid/api/v1/login");
    expect(options.body).toEqual(body);
    expect(options.headers).toMatchObject({
      origin: "https://school.invalid",
      cookie: "session=fictional",
    });
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining("HttpOnly; Secure"),
    ]);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.bytes.toString()).toBe('{"ok":true}');
  });
  it("streams authorized byte ranges without changing their contents or status", async () => {
    vi.stubEnv("COTEACHER_BACKEND_URL", "https://fictional-backend.invalid");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 206,
            headers: {
              "Content-Range": "bytes 4-6/10",
              "Accept-Ranges": "bytes",
              "Content-Type": "audio/ogg",
            },
          }),
      ),
    );
    const response = await invoke(
      request("v1/media/fictional", "GET", undefined, { range: "bytes=4-6" }),
    );
    expect(response.statusCode).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 4-6/10");
    expect(response.bytes).toEqual(Buffer.from([1, 2, 3]));
  });
  it("rejects demo routes and returns readable JSON for oversized uploads and provider failure", async () => {
    vi.stubEnv("COTEACHER_BACKEND_URL", "https://fictional-backend.invalid");
    const upstream = vi.fn(async () => {
      throw new Error("Simulated outage");
    });
    vi.stubGlobal("fetch", upstream);
    expect((await invoke(request("publish"))).statusCode).toBe(404);
    expect(
      (await invoke(request("v1/uploads", "POST", Buffer.alloc(4_000_001))))
        .statusCode,
    ).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
    const failure = await invoke(request("v1/me"));
    expect(failure.statusCode).toBe(502);
    expect(JSON.parse(failure.bytes.toString()).error).toContain("unavailable");
  });
});
