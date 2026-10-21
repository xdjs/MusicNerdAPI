import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, summary } = vi.hoisted(() => ({ auth: vi.fn(), summary: vi.fn() }));
vi.mock("@/lib/profile/authenticateProfileRequest", () => ({ authenticateProfileRequest: auth }));
vi.mock("@/lib/profile/getProfileSummary", () => ({ getProfileSummary: summary }));
const { getProfileSummaryHandler } = await import("@/lib/profile/getProfileSummaryHandler");

const request = new Request("https://x/api/profile/summary");
const counts = {
  totalContributions: 4,
  selfEdits: 2,
  artistsAdded: 1,
  approved: 3,
  pending: 1,
  entries: [],
};

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  summary.mockReset().mockResolvedValue(counts);
});

describe("getProfileSummaryHandler", () => {
  it("returns the summary with the user id, no-store", async () => {
    const res = await getProfileSummaryHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...counts, userId: "u1" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(summary).toHaveBeenCalledWith("u1");
  });

  it("forwards the auth response", async () => {
    const changed = NextResponse.json({ status: "error", error: "x" }, { status: 409 });
    auth.mockResolvedValue(changed);
    expect(await getProfileSummaryHandler(request)).toBe(changed);
  });

  it("is 503 when the database fails", async () => {
    summary.mockRejectedValue(new Error("down"));
    const res = await getProfileSummaryHandler(request);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not load your contributions. Try again.",
    });
  });

  it("answers JSON 503 with CORS when authentication throws", async () => {
    auth.mockRejectedValue(new Error("user lookup failed"));
    const res = await getProfileSummaryHandler(request);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not load your contributions. Try again.",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
