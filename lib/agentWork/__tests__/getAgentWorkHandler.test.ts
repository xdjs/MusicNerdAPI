import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, summary, details } = vi.hoisted(() => ({
  auth: vi.fn(),
  summary: vi.fn(),
  details: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/agentWork/getAgentWorkSummary", () => ({ getAgentWorkSummary: summary }));
vi.mock("@/lib/agentWork/getAgentWorkDetails", () => ({ getAgentWorkDetails: details }));
const { getAgentWorkHandler } = await import("@/lib/agentWork/getAgentWorkHandler");

const req = (q = "") => new Request(`https://x/api/admin/agent-work${q}`);

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  summary.mockReset();
  details.mockReset();
});

describe("getAgentWorkHandler", () => {
  it("returns the summary by default", async () => {
    summary.mockResolvedValueOnce({ workers: [] });
    expect(await (await getAgentWorkHandler(req())).json()).toEqual({ status: "ok", workers: [] });
  });

  it("returns paged details on request", async () => {
    details.mockResolvedValueOnce({ runHistory: { runs: [], total: 0 } });
    const res = await getAgentWorkHandler(req("?sections=details&auditPage=2&auditLimit=x"));
    expect(await res.json()).toEqual({ status: "ok", runHistory: { runs: [], total: 0 } });
    expect(details).toHaveBeenCalledWith(2, 50);
  });

  it("is a 500 when a query fails", async () => {
    summary.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await getAgentWorkHandler(req())).status).toBe(500);
  });

  it("passes through auth failures", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await getAgentWorkHandler(req())).status).toBe(401);
    expect(summary).not.toHaveBeenCalled();
  });
});
