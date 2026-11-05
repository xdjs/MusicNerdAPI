import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postRejectClaimHandler } from "@/lib/claims/postRejectClaimHandler";

const m = vi.hoisted(() => ({ auth: vi.fn(), set: vi.fn(), label: vi.fn(), discord: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: m.auth }));
vi.mock("@/lib/claims/setClaimStatus", () => ({ setClaimStatus: m.set }));
vi.mock("@/lib/claims/userLabel", () => ({ userLabel: m.label }));
vi.mock("@/lib/discord/sendDiscordMessage", () => ({ sendDiscordMessage: m.discord }));

const ID = "3c0b6f9e-2d4a-4e8b-9f1c-5a7d2e6b8c41";
const req = () => new Request(`https://api/api/admin/claims/${ID}/reject`, { method: "POST" });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "admin" });
  m.set.mockResolvedValue({ id: ID, artistId: "a1", referenceCode: "MN-ABCD" });
  m.label.mockResolvedValue("admin@example.test");
});

describe("postRejectClaimHandler", () => {
  it("rejects and tells the team", async () => {
    const res = await postRejectClaimHandler(req(), ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(m.set).toHaveBeenCalledWith(ID, "rejected");
    expect(m.discord).toHaveBeenCalledWith(
      "Claim REJECTED: MN-ABCD | Artist ID: a1 | Rejected by: admin@example.test",
    );
  });

  it("is 404 for an unknown claim", async () => {
    m.set.mockResolvedValueOnce(undefined);
    const res = await postRejectClaimHandler(req(), ID);
    expect(res.status).toBe(404);
    expect(m.discord).not.toHaveBeenCalled();
  });

  it("is 400 for a non-UUID id and forwards the admin check", async () => {
    expect((await postRejectClaimHandler(req(), "nope")).status).toBe(400);
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postRejectClaimHandler(req(), ID)).status).toBe(401);
  });

  it("is 500 on a database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.set.mockRejectedValueOnce(new Error("db down"));
    expect((await postRejectClaimHandler(req(), ID)).status).toBe(500);
  });
});
