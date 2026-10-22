import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getPendingUGCCountHandler } from "@/lib/ugc/getPendingUGCCountHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/ugc/countPendingUGC", () => ({ countPendingUGC: mock.count }));

const request = new Request("https://api.musicnerd.test/api/pendingUGCCount");

beforeEach(() => vi.clearAllMocks());

describe("getPendingUGCCountHandler", () => {
  it("returns the count for an admin", async () => {
    mock.auth.mockResolvedValueOnce({ userId: "admin" });
    mock.count.mockResolvedValueOnce(3);
    const res = await getPendingUGCCountHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", count: 3 });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it.each([401, 403])(
    "answers %s from the admin check with count 0, not an error",
    async status => {
      mock.auth.mockResolvedValueOnce(
        NextResponse.json({ status: "error", error: "x" }, { status }),
      );
      const res = await getPendingUGCCountHandler(request);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", count: 0 });
      expect(mock.count).not.toHaveBeenCalled();
    },
  );

  it("answers a failure with count 0, as MusicNerdWeb did", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.auth.mockResolvedValueOnce({ userId: "admin" });
    mock.count.mockRejectedValueOnce(new Error("db down"));
    const res = await getPendingUGCCountHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", count: 0 });
  });
});
