import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticateRequest, summaries } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  summaries: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/profile/getArtistSummaries", () => ({ getArtistSummaries: summaries }));
const { getProfileArtistSummariesHandler } =
  await import("@/lib/profile/getProfileArtistSummariesHandler");

const a = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const request = (query = `?id=${a}`) =>
  new Request(`https://x/api/profile/artist-summaries${query}`);

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  summaries.mockReset().mockResolvedValue([{ id: a, bio: "Bio Ritmo is a salsa band." }]);
});

describe("getProfileArtistSummariesHandler", () => {
  it("wraps the rows as summaries, no-store", async () => {
    const res = await getProfileArtistSummariesHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      summaries: [{ id: a, bio: "Bio Ritmo is a salsa band." }],
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(summaries).toHaveBeenCalledWith([a]);
  });

  it("forwards the 401", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    authenticateRequest.mockResolvedValue(denied);
    expect(await getProfileArtistSummariesHandler(request())).toBe(denied);
  });

  it("is 400 without ids", async () => {
    expect((await getProfileArtistSummariesHandler(request(""))).status).toBe(400);
    expect(summaries).not.toHaveBeenCalled();
  });

  it("is 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    summaries.mockRejectedValue(new Error("down"));
    const res = await getProfileArtistSummariesHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
