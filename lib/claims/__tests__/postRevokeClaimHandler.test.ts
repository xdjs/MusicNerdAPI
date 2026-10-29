import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postRevokeClaimHandler } from "@/lib/claims/postRevokeClaimHandler";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  revoke: vi.fn(),
  purge: vi.fn(),
  audit: vi.fn(),
  label: vi.fn(),
  discord: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: m.auth }));
vi.mock("@/lib/claims/getClaimById", () => ({ getClaimById: m.get }));
vi.mock("@/lib/claims/revokeApprovedClaim", () => ({ revokeApprovedClaim: m.revoke }));
vi.mock("@/lib/claims/purgeClaimStorage", () => ({ purgeClaimStorage: m.purge }));
vi.mock("@/lib/mcp/logMcpAudit", () => ({ logMcpAudit: m.audit }));
vi.mock("@/lib/claims/userLabel", () => ({ userLabel: m.label }));
vi.mock("@/lib/discord/sendDiscordMessage", () => ({ sendDiscordMessage: m.discord }));

const ID = "3c0b6f9e-2d4a-4e8b-9f1c-5a7d2e6b8c41";
const claim = {
  id: ID,
  artistId: "a1",
  userId: "claimant",
  referenceCode: "MN-ABCD",
  status: "approved",
};
const req = () => new Request(`https://api/api/admin/claims/${ID}/revoke`, { method: "POST" });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "admin" });
  m.get.mockResolvedValue(claim);
  m.revoke.mockResolvedValue(claim);
  m.purge.mockResolvedValue(undefined);
  m.audit.mockResolvedValue(undefined);
  m.label.mockResolvedValue("admin@example.test");
});

describe("postRevokeClaimHandler", () => {
  it("revokes, purges the artist's files, records the audit and tells the team", async () => {
    const res = await postRevokeClaimHandler(req(), ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(m.revoke).toHaveBeenCalledWith(ID);
    expect(m.purge).toHaveBeenCalledWith("a1");
    expect(m.audit).toHaveBeenCalledWith({
      artistId: "a1",
      field: "claim",
      action: "delete",
      oldValue: "approved|MN-ABCD",
      newValue: null,
      apiKeyHash: "admin:admin",
    });
    expect(m.discord).toHaveBeenCalledWith(
      "Claim REVOKED: MN-ABCD | Artist ID: a1 | Revoked by: admin@example.test",
    );
  });

  it("still succeeds when the audit write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.audit.mockRejectedValueOnce(new Error("db down"));
    expect((await postRevokeClaimHandler(req(), ID)).status).toBe(200);
  });

  it("is 404 for an unknown claim", async () => {
    m.get.mockResolvedValueOnce(undefined);
    const res = await postRevokeClaimHandler(req(), ID);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Claim not found" });
  });

  it("is 409 for a claim that isn't approved, before or during the revoke", async () => {
    m.get.mockResolvedValueOnce({ ...claim, status: "pending" });
    let res = await postRevokeClaimHandler(req(), ID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "error", error: "Can only revoke approved claims" });
    expect(m.revoke).not.toHaveBeenCalled();
    m.revoke.mockResolvedValueOnce(undefined);
    res = await postRevokeClaimHandler(req(), ID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "error", error: "Claim is no longer approved" });
    expect(m.purge).not.toHaveBeenCalled();
  });

  it("is 400 for a non-UUID id and forwards the admin check", async () => {
    expect((await postRevokeClaimHandler(req(), "nope")).status).toBe(400);
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await postRevokeClaimHandler(req(), ID)).status).toBe(403);
  });

  it("is 500 when the revoke can't be saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.revoke.mockRejectedValueOnce(new Error("db down"));
    expect((await postRevokeClaimHandler(req(), ID)).status).toBe(500);
  });
});
