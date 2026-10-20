import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, summary } = vi.hoisted(() => ({ auth: vi.fn(), summary: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/artistData/getArtistDataSummary", () => ({ getArtistDataSummary: summary }));

const req = () => new Request("https://x/api/admin/artist-data");
const load = async () =>
  (await import("@/lib/artistData/getArtistDataHandler")).getArtistDataHandler;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  summary.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("getArtistDataHandler", () => {
  it("reuses the summary for 30 seconds", async () => {
    const handler = await load();
    summary.mockResolvedValueOnce({ totalArtists: 1 }).mockResolvedValueOnce({ totalArtists: 2 });
    expect(await (await handler(req())).json()).toEqual({ status: "ok", totalArtists: 1 });
    vi.advanceTimersByTime(29_000);
    expect(await (await handler(req())).json()).toEqual({ status: "ok", totalArtists: 1 });
    vi.advanceTimersByTime(2_000);
    expect(await (await handler(req())).json()).toEqual({ status: "ok", totalArtists: 2 });
    expect(summary).toHaveBeenCalledTimes(2);
  });

  it("shares one read between concurrent requests", async () => {
    const handler = await load();
    summary.mockResolvedValueOnce({ totalArtists: 1 });
    await Promise.all([handler(req()), handler(req())]);
    expect(summary).toHaveBeenCalledTimes(1);
  });

  it("is a 500 when the summary fails", async () => {
    const handler = await load();
    summary.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await handler(req())).status).toBe(500);
  });

  it("passes through auth failures", async () => {
    const handler = await load();
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await handler(req())).status).toBe(403);
    expect(summary).not.toHaveBeenCalled();
  });
});
