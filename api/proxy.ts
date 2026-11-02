import type { IncomingMessage, ServerResponse } from "node:http";
import { once } from "node:events";

/** Same-origin BFF proxy for the three Vercel projects. No provider secrets reach browsers. */
export default async function proxy(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const error = (status: number, message: string) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ error: message }));
  };
  const backend = process.env.COTEACHER_BACKEND_URL;
  if (!backend?.startsWith("https://")) {
    error(503, "Configure the Coteacher backend.");
    return;
  }
  const url = new URL(request.url ?? "/", "https://localhost");
  // Accept the original browser URL as well as the rewrite destination URL.
  // A user-supplied query parameter must never override an original API path.
  const path = /^\/api\/(?:v1(?:\/|$)|health$)/.test(url.pathname)
    ? url.pathname.slice(5)
    : (url.searchParams.get("path") ?? "");
  url.searchParams.delete("path");
  if (!/^(v1(?:\/|$)|health$)/.test(path) || path.includes("..")) {
    error(404, "Unknown school endpoint.");
    return;
  }
  const target = new URL("/api/" + path, backend);
  target.search = url.search;
  const headers: Record<string, string> = {};
  for (const name of [
    "cookie",
    "content-type",
    "range",
    "origin",
    "sec-fetch-site",
  ]) {
    const value = request.headers[name];
    if (typeof value === "string") headers[name] = value;
  }
  const controller = new AbortController();
  request.on("aborted", () => controller.abort());
  response.on("close", () => controller.abort());
  try {
    const chunks: Buffer[] = [];
    let length = 0;
    if (!["GET", "HEAD"].includes(request.method ?? "GET"))
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 4_000_000) {
          error(413, "Use private recording upload.");
          return;
        }
        chunks.push(chunk);
      }
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: "manual",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
    });
    response.statusCode = upstream.status;
    for (const name of [
      "content-type",
      "content-range",
      "accept-ranges",
      "cache-control",
      "x-content-type-options",
    ]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) response.setHeader("Set-Cookie", cookies);
    response.setHeader("Cache-Control", "no-store");
    // Stream media rather than buffering it in a serverless function response.
    if (request.method === "HEAD" || !upstream.body) {
      response.end();
      return;
    }
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!response.write(value))
          await once(response, "drain", { signal: controller.signal });
      }
      response.end();
    } finally {
      reader.releaseLock();
    }
  } catch {
    if (!response.headersSent) {
      error(
        502,
        "The school service is unavailable. Your saved learning is safe.",
      );
    } else response.destroy();
  }
}
