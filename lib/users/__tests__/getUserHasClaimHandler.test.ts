import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticateRequest, getClaim } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getClaim: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/users/getApprovedClaimByUserId", () => ({ getApprovedClaimByUserId: getClaim }));
const { getUserHasClaimHandler } = await import("@/lib/users/getUserHasClaimHandler");

const request = new Request("https://x/api/user/has-claim");

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  getClaim.mockReset();
});

describe("getUserHasClaimHandler", () => {
  it("answers the approved claim's artist", async () => {
    getClaim.mockResolvedValue({ id: "c1", userId: "u1", artistId: "a1", status: "approved" });
    const res = await getUserHasClaimHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", hasClaim: true, artistId: "a1" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(getClaim).toHaveBeenCalledWith("u1");
  });

  it("answers false without a claim", async () => {
    getClaim.mockResolvedValue(undefined);
    expect(await (await getUserHasClaimHandler(request)).json()).toEqual({
      status: "ok",
      hasClaim: false,
      artistId: null,
    });
  });

  it("answers 200 false, not 401, without a valid token", async () => {
    authenticateRequest.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await getUserHasClaimHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", hasClaim: false, artistId: null });
    expect(getClaim).not.toHaveBeenCalled();
  });

  it("answers 200 false when authentication itself throws", async () => {
    authenticateRequest.mockRejectedValue(new Error("privy down"));
    const res = await getUserHasClaimHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", hasClaim: false, artistId: null });
  });
});
