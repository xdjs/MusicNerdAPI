import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  canEdit: vi.fn(),
  claim: vi.fn(),
  operation: vi.fn(),
  request: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEdit }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation: m.operation }));
vi.mock("@/lib/latest/requestLatestRefresh", () => ({ requestLatestRefresh: m.request }));
vi.mock("@/lib/latest/getLatestRefresh", () => ({ getLatestRefresh: m.read }));
const { handleLatestRefresh } = await import("@/lib/latest/handleLatestRefresh");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const artistId = "11111111-1111-4111-8111-111111111111";
const request = (method = "GET") =>
  new Request(`https://api.example/api/artist/${artistId}/latest-refresh`, {
    method,
    headers: { Authorization: "Bearer token" },
  });
const view = {
  id: "job-1",
  status: "pending",
  requestedAt: "2026-10-21T00:00:00.000Z",
  sources: {},
  retryAt: "2026-10-21T00:30:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.canEdit.mockResolvedValue(true);
  m.claim.mockResolvedValue({ id: "c1", userId: "u1" });
  m.operation.mockImplementation((_artistId, _ownership, fn) => fn());
  m.request.mockResolvedValue("job-1");
  m.read.mockResolvedValue(view);
});

describe("handleLatestRefresh", () => {
  it("rejects a non-UUID artist before authenticating", async () => {
    const res = await handleLatestRefresh(request(), "not-a-uuid", false);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid artist" });
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    m.auth.mockResolvedValue(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await handleLatestRefresh(request(), artistId, false);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", error: "Sign in to update Latest." });
    expect(m.read).not.toHaveBeenCalled();
  });

  it("requires the claimant or an admin", async () => {
    m.canEdit.mockResolvedValue(false);
    const res = await handleLatestRefresh(request("POST"), artistId, true);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Only this artist or an admin can update Latest.",
    });
    expect(m.canEdit).toHaveBeenCalledWith("u1", artistId);
    expect(m.request).not.toHaveBeenCalled();
  });

  it("GET reads the request in scope without queueing, private and uncached", async () => {
    const res = await handleLatestRefresh(request(), artistId, false);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", refresh: view });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(m.operation).not.toHaveBeenCalled();
    expect(m.request).not.toHaveBeenCalled();
  });

  it("GET returns refresh: null when nothing is in scope", async () => {
    m.read.mockResolvedValue(null);
    const res = await handleLatestRefresh(request(), artistId, false);
    expect(await res.json()).toEqual({ status: "ok", refresh: null });
  });

  it("POST queues the request as the user under the current claim, then reads it", async () => {
    const res = await handleLatestRefresh(request("POST"), artistId, true);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", refresh: view });
    expect(m.operation.mock.calls[0].slice(0, 2)).toEqual([
      artistId,
      { userId: "u1", expectedClaimId: "c1", trigger: "manual_latest_refresh" },
    ]);
    expect(m.request).toHaveBeenCalledWith(artistId);
    expect(m.read).toHaveBeenCalledWith(artistId);
  });

  it("POST runs with a null claim generation for an unclaimed artist", async () => {
    m.claim.mockResolvedValue(undefined);
    await handleLatestRefresh(request("POST"), artistId, true);
    expect(m.operation.mock.calls[0][1]).toMatchObject({ expectedClaimId: null });
  });

  it("reports a claim that changed while queueing as 403", async () => {
    m.request.mockRejectedValue(new OwnershipChangedError());
    const res = await handleLatestRefresh(request("POST"), artistId, true);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Your access changed. Reload the profile.",
    });
  });

  it("reports any other failure as 503 without its message", async () => {
    m.read.mockRejectedValue(new Error("connection refused"));
    const res = await handleLatestRefresh(request(), artistId, false);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Latest could not be checked. Please try again.",
    });
  });

  it("answers a JSON error with CORS when the account lookup throws", async () => {
    m.auth.mockRejectedValue(new Error("pool exhausted"));
    const res = await handleLatestRefresh(request(), artistId, true);
    expect(res.status).toBe(503);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "error",
      error: "Latest could not be checked. Please try again.",
    });
    expect(m.request).not.toHaveBeenCalled();
  });
});
