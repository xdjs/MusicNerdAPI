import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), claim: vi.fn(), state: vi.fn(), start: vi.fn() }));
vi.mock("@/lib/questionResearch/authenticateResearchRequest", () => ({
  authenticateResearchRequest: m.auth,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/onboarding/getOnboardingState", () => ({ getOnboardingState: m.state }));
vi.mock("@/lib/claimBuild/startClaimBuild", () => ({ startClaimBuild: m.start }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
const { postClaimBuildHandler } = await import("@/lib/claimBuild/postClaimBuildHandler");

const ID = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const req = () => new Request(`https://api/api/onboarding/${ID}/build`, { method: "POST" });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ kind: "service" });
  m.claim.mockResolvedValue({ id: "c1", userId: "claimant" });
  m.state.mockResolvedValue({ complete: false, currentStep: "profiles" });
  m.start.mockResolvedValue("wrun_1");
});

describe("postClaimBuildHandler", () => {
  it("starts the build as the approved claimant, under the claim", async () => {
    const res = await postClaimBuildHandler(req(), ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", started: true, runId: "wrun_1" });
    expect(m.auth).toHaveBeenCalledWith(expect.any(Request), ID, false);
    expect(m.start).toHaveBeenCalledWith(ID, { userId: "claimant", expectedClaimId: "c1" });
  });

  it("builds as the claimant even when an admin restarts it", async () => {
    m.auth.mockResolvedValueOnce({ kind: "artist", userId: "admin" });
    await postClaimBuildHandler(req(), ID);
    expect(m.start).toHaveBeenCalledWith(ID, { userId: "claimant", expectedClaimId: "c1" });
  });

  it("starts nothing for a page that's already built", async () => {
    m.state.mockResolvedValueOnce({ complete: true, currentStep: null });
    const res = await postClaimBuildHandler(req(), ID);
    expect(await res.json()).toEqual({ status: "ok", started: false, runId: null });
    expect(m.start).not.toHaveBeenCalled();
  });

  it("is 409 without an approved claim", async () => {
    m.claim.mockResolvedValueOnce(undefined);
    const res = await postClaimBuildHandler(req(), ID);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ status: "error", error: "No approved claim" });
  });

  it("is 400 for a bad artist id", async () => {
    const res = await postClaimBuildHandler(req(), "nope");
    expect(res.status).toBe(400);
  });

  it("passes on a failed sign-in", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    const res = await postClaimBuildHandler(req(), ID);
    expect(res.status).toBe(403);
    expect(m.start).not.toHaveBeenCalled();
  });

  it("is 503 when the build can't be started", async () => {
    m.start.mockRejectedValueOnce(new Error("queue down"));
    const res = await postClaimBuildHandler(req(), ID);
    expect(res.status).toBe(503);
  });
});
