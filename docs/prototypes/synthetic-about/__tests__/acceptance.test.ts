import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/db", async () => await import("../context"));
vi.mock("@/lib/lore/synthesizeArtistDoc", async () => ({
  synthesizeArtistDoc: (await import("../modelRuntime")).adapter.synthesizeArtistDoc,
}));
vi.mock("@/lib/lore/generateAboutFromDoc", async () => ({
  generateAboutFromDoc: (await import("../modelRuntime")).adapter.generateAboutFromDoc,
}));
vi.mock("@/lib/lore/generateLoreSummary", async () => ({
  generateLoreSummary: (await import("../modelRuntime")).adapter.generateLoreSummary,
}));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({
  verifyPrivyAccessToken: async (token: string) =>
    token === "admin-token"
      ? "synthetic-admin"
      : token === "regular-token"
        ? "synthetic-regular"
        : null,
}));
const { createAcceptance } = await import("../acceptance");
const { db } = await import("../context");
const { verifyPrivyAccessToken } = await import("@/lib/auth/verifyPrivyAccessToken");
const network = vi.fn(() => {
  throw Error("Network forbidden");
});
vi.stubGlobal("fetch", network);
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  expect(network).not.toHaveBeenCalled();
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const create = () =>
  createAcceptance({
    subjects: { [hash("synthetic-admin")]: true, [hash("synthetic-regular")]: false },
    verify: verifyPrivyAccessToken,
    loadRoutes: () => import("@/app/api/artistBio/[id]/route"),
    sqlRoot: resolve("docs/prototypes/hosted-about"),
  });
const request = (token?: string, body?: string) =>
  new Request("http://test.invalid/api/acceptance", {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : undefined,
    ...(body ? { body } : {}),
  });
it("rejects arbitrary content and unsigned requests before loading routes", async () => {
  const verify = vi.fn();
  const loadRoutes = vi.fn();
  const h = createAcceptance({ subjects: {}, verify, loadRoutes });
  expect((await h(request("token", '{"bio":"private text"}'))).status).toBe(400);
  expect((await h(request())).status).toBe(401);
  expect(verify).not.toHaveBeenCalled();
  expect(loadRoutes).not.toHaveBeenCalled();
});
it("refuses an otherwise verified subject not in the fixed test manifest", async () => {
  const loadRoutes = vi.fn();
  const h = createAcceptance({ subjects: {}, verify: async () => "other-subject", loadRoutes });
  expect((await h(request("token"))).status).toBe(403);
  expect(loadRoutes).not.toHaveBeenCalled();
});
// These integration cases boot fresh PostgreSQL WASM instances and install the full
// synthetic schema. Allow the same 30s budget as the other PGlite integration tests;
// request cancellation/body deadlines below retain their original assertions.
it("keeps concurrent admin and regular/claimant fixtures and counters separate", async () => {
  const h = create();
  const replies = await Promise.all([h(request("admin-token")), h(request("regular-token"))]);
  const results = await Promise.all(
    replies.map(async r => ({ http: r.status, body: await r.json() })),
  );
  expect(results.map(r => r.http)).toEqual([200, 200]);
  expect(results[0].body).toMatchObject({
    status: "passed",
    actor: "admin",
    outsiderStatus: null,
    calls: { lore: 1, about: 2, summary: 1 },
  });
  expect(results[1].body).toMatchObject({
    status: "passed",
    actor: "synthetic_claimant",
    outsiderStatus: 403,
    calls: { lore: 1, about: 2, summary: 1 },
  });
  expect(() => db.query).toThrow("outside request scope");
}, 30000);
it("closes request scope after a route throws", async () => {
  const h = createAcceptance({
    subjects: { [hash("synthetic-admin")]: true },
    verify: verifyPrivyAccessToken,
    loadRoutes: async () => {
      throw Error("fixture failure");
    },
    sqlRoot: resolve("docs/prototypes/hosted-about"),
  });
  expect((await h(request("admin-token"))).status).toBe(500);
  expect(() => db.query).toThrow("outside request scope");
}, 30000);
it("rejects an aborted request before verification", async () => {
  const verify = vi.fn();
  const loadRoutes = vi.fn();
  const h = createAcceptance({ subjects: {}, verify, loadRoutes });
  const controller = new AbortController();
  controller.abort();
  expect(
    (
      await h(
        new Request("http://test.invalid/api/acceptance", {
          method: "POST",
          signal: controller.signal,
        }),
      )
    ).status,
  ).toBe(408);
  expect(verify).not.toHaveBeenCalled();
});
it("bounds simultaneous work and releases capacity after verification fails", async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  const verify = vi.fn(async () => {
    await wait;
    return null;
  });
  const h = createAcceptance({ subjects: {}, verify, loadRoutes: vi.fn() });
  const a = h(request("token"));
  const b = h(request("token"));
  expect((await h(request("token"))).status).toBe(429);
  release();
  expect((await a).status).toBe(401);
  expect((await b).status).toBe(401);
  expect((await h(request("token"))).status).toBe(401);
});

it("accepts an empty body stream as supplied by hosted Next", async () => {
  const verify = vi.fn(async () => "other-subject");
  const h = createAcceptance({ subjects: {}, verify, loadRoutes: vi.fn() });
  const body = new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
  const init = {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body,
    duplex: "half",
  } as RequestInit;
  expect((await h(new Request("http://test.invalid/api/acceptance", init))).status).toBe(403);
  expect(verify).toHaveBeenCalledOnce();
});

it("bounds stalled input before verification even when cancellation never settles", async () => {
  vi.useFakeTimers();
  try {
    const verify = vi.fn();
    const h = createAcceptance({ subjects: {}, verify, loadRoutes: vi.fn() });
    const body = new ReadableStream({ cancel: () => new Promise(() => {}) });
    const pending = h(
      new Request("http://test.invalid/api/acceptance", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body,
        duplex: "half",
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(2001);
    expect((await pending).status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it("stops a body read on request cancellation", async () => {
  const verify = vi.fn();
  const h = createAcceptance({ subjects: {}, verify, loadRoutes: vi.fn() });
  const controller = new AbortController();
  const pending = h(
    new Request("http://test.invalid/api/acceptance", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      signal: controller.signal,
      body: new ReadableStream(),
      duplex: "half",
    } as RequestInit),
  );
  controller.abort();
  expect((await pending).status).toBe(400);
  expect(verify).not.toHaveBeenCalled();
});
