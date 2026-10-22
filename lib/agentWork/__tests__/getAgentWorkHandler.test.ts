import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getAgentWorkHandler } from "@/lib/agentWork/getAgentWorkHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), summary: vi.fn(), details: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/agentWork/getAgentWorkSummary", () => ({ getAgentWorkSummary: mock.summary }));
vi.mock("@/lib/agentWork/getAgentWorkDetails", () => ({ getAgentWorkDetails: mock.details }));

const request = (query = "") =>
  new Request(`https://api.musicnerd.test/api/admin/agent-work${query}`);
const summary = {
  stats: { totalArtistsWithSpotify: 1000, totalArtistsWithDeezer: 10, platformStats: [] },
  activityPulse: { lastWriteAt: null, rateLastHour: 0 },
  hourlyActivity: [],
  workers: [],
};
const details = {
  auditLog: { entries: [], total: 0, page: 1, limit: 50 },
  agentBreakdown: { agents: [] },
  exclusions: { platforms: {} },
  runHistory: { runs: [], total: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
  mock.summary.mockResolvedValue(summary);
  mock.details.mockResolvedValue(details);
});

describe("getAgentWorkHandler", () => {
  it("returns the summary by default", async () => {
    const res = await getAgentWorkHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...summary });
    expect(mock.details).not.toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns the details with the audit page when sections=details", async () => {
    const res = await getAgentWorkHandler(request("?sections=details&auditPage=2&auditLimit=25"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...details });
    expect(mock.details).toHaveBeenCalledWith(2, 25);
    expect(mock.summary).not.toHaveBeenCalled();
  });

  it("forwards the admin check's 401 or 403", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await getAgentWorkHandler(request())).status).toBe(401);
    expect(mock.summary).not.toHaveBeenCalled();
  });

  it("answers a database failure with MusicNerdWeb's 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.summary.mockRejectedValueOnce(new Error("db down"));
    const res = await getAgentWorkHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
