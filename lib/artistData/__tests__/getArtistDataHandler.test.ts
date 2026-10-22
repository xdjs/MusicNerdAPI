import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ auth: vi.fn(), summary: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/artistData/getArtistDataSummary", () => ({ getArtistDataSummary: mock.summary }));

const request = new Request("https://api.musicnerd.test/api/admin/artist-data");
const summary = (totalArtists: number) => ({
  totalArtists,
  totalWithSpotify: 1,
  platformIdCoverage: [],
  artistLinkCoverage: [],
  completenessDistribution: [],
  medianFields: 0,
  averageFields: 0,
  enrichmentReadiness: { hasWikidata: 0, hasSpotifyNoWikidata: 0, noSpotify: 0 },
});

// The cache lives in the module, so each test gets a fresh import.
async function handler() {
  vi.resetModules();
  return (await import("@/lib/artistData/getArtistDataHandler")).getArtistDataHandler;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
  mock.auth.mockResolvedValue({ userId: "admin" });
});

afterEach(() => vi.useRealTimers());

describe("getArtistDataHandler", () => {
  it("returns the summary with status ok and CORS headers", async () => {
    mock.summary.mockResolvedValueOnce(summary(10));
    const res = await (await handler())(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...summary(10) });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("reuses the summary for 30 seconds, then reads again", async () => {
    const get = await handler();
    mock.summary.mockResolvedValueOnce(summary(10)).mockResolvedValueOnce(summary(11));
    await get(request);
    vi.setSystemTime(new Date("2026-10-21T12:00:29Z"));
    expect((await (await get(request)).json()).totalArtists).toBe(10);
    expect(mock.summary).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-21T12:00:31Z"));
    expect((await (await get(request)).json()).totalArtists).toBe(11);
    expect(mock.summary).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight read between concurrent callers", async () => {
    const get = await handler();
    let resolve!: (value: unknown) => void;
    mock.summary.mockReturnValueOnce(new Promise(r => (resolve = r)));
    const first = get(request);
    const second = get(request);
    resolve(summary(10));
    const [a, b] = await Promise.all([first, second]);
    expect((await a.json()).totalArtists).toBe(10);
    expect((await b.json()).totalArtists).toBe(10);
    expect(mock.summary).toHaveBeenCalledTimes(1);
  });

  it("checks the admin before serving the cache", async () => {
    const get = await handler();
    mock.summary.mockResolvedValueOnce(summary(10));
    await get(request);
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await get(request)).status).toBe(403);
  });

  it("answers a failure with MusicNerdWeb's 500 and does not cache it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const get = await handler();
    mock.summary.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(summary(10));
    const res = await get(request);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect((await get(request)).status).toBe(200);
  });
});
