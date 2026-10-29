import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postApproveClaimHandler } from "@/lib/claims/postApproveClaimHandler";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  set: vi.fn(),
  work: vi.fn(),
  label: vi.fn(),
  discord: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: m.auth }));
vi.mock("@/lib/claims/setClaimStatus", () => ({ setClaimStatus: m.set }));
vi.mock("@/lib/claims/startClaimApprovalWork", () => ({ startClaimApprovalWork: m.work }));
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
const req = () => new Request(`https://api/api/admin/claims/${ID}/approve`, { method: "POST" });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "admin" });
  m.set.mockResolvedValue(claim);
  m.work.mockResolvedValue(undefined);
  m.label.mockResolvedValue("admin@example.test");
});

describe("postApproveClaimHandler", () => {
  it("approves, starts the work and tells the team", async () => {
    const res = await postApproveClaimHandler(req(), ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(m.set).toHaveBeenCalledWith(ID, "approved");
    expect(m.work).toHaveBeenCalledWith(claim, "admin");
    expect(m.discord).toHaveBeenCalledWith(
      "Claim APPROVED: MN-ABCD | Artist ID: a1 | Approved by: admin@example.test",
    );
  });

  it("returns the work's warning with the approval", async () => {
    m.work.mockResolvedValueOnce("Claim approved, but …");
    expect(await (await postApproveClaimHandler(req(), ID)).json()).toEqual({
      status: "ok",
      warning: "Claim approved, but …",
    });
  });

  it("is 404 for an unknown claim, with no side effects", async () => {
    m.set.mockResolvedValueOnce(undefined);
    const res = await postApproveClaimHandler(req(), ID);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Claim not found" });
    expect(m.work).not.toHaveBeenCalled();
  });

  it("is 400 for a non-UUID id and forwards the admin check", async () => {
    expect((await postApproveClaimHandler(req(), "nope")).status).toBe(400);
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await postApproveClaimHandler(req(), ID)).status).toBe(403);
    expect(m.set).not.toHaveBeenCalled();
  });

  it("is 500 when the approval can't be saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.set.mockRejectedValueOnce(new Error("db down"));
    expect((await postApproveClaimHandler(req(), ID)).status).toBe(500);
  });
});
