import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchWithoutAcceptLanguage } from "@/lib/networking/fetchWithoutAcceptLanguage";

let server: Server;
let base: string;
let seen: IncomingHttpHeaders = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    seen = req.headers;
    if (req.url === "/slow") return void setTimeout(() => res.end("{}"), 500);
    res.writeHead(req.url === "/missing" ? 404 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ href: "https://api.spotify.com/v1/artists/a" }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

describe("fetchWithoutAcceptLanguage", () => {
  it("sends the caller's headers and no Accept-Language, unlike fetch", async () => {
    await fetch(`${base}/ok`);
    expect(seen["accept-language"]).toBe("*");

    const res = await fetchWithoutAcceptLanguage(`${base}/ok`, {
      headers: { Authorization: "Bearer t" },
    });
    expect(seen["accept-language"]).toBeUndefined();
    expect(seen.authorization).toBe("Bearer t");
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual({ href: "https://api.spotify.com/v1/artists/a" });
  });

  it("returns error statuses as responses", async () => {
    const res = await fetchWithoutAcceptLanguage(`${base}/missing`);
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
  });

  it("rejects when the signal aborts", async () => {
    await expect(
      fetchWithoutAcceptLanguage(`${base}/slow`, { signal: AbortSignal.timeout(50) }),
    ).rejects.toThrow();
  });
});
