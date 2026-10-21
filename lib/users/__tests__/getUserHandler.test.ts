import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, getUserById } = vi.hoisted(() => ({ auth: vi.fn(), getUserById: vi.fn() }));
vi.mock("@/lib/users/authenticateOwnAccount", () => ({ authenticateOwnAccount: auth }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById }));
const { getUserHandler } = await import("@/lib/users/getUserHandler");

const request = new Request("https://x/api/user/u1");
const user = {
  id: "u1",
  email: null,
  username: "Vinyl Otter",
  usernameNeedsConfirmation: true,
  usernamePromptedAt: null,
  wallet: null,
  privyUserId: "did:privy:x",
  createdAt: "2026-10-01T12:00:00+00:00",
  updatedAt: "2026-10-01T12:00:00+00:00",
  legacyId: null,
  isAdmin: false,
  isWhiteListed: false,
  isSuperAdmin: false,
  isHidden: false,
  legacyLinkDismissed: false,
  acceptedUgcCount: 3,
};

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  getUserById.mockReset();
});

describe("getUserHandler", () => {
  it("returns the caller's row with status ok and CORS headers", async () => {
    getUserById.mockResolvedValue(user);
    const res = await getUserHandler(request, "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...user });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(auth).toHaveBeenCalledWith(request, "u1");
    expect(getUserById).toHaveBeenCalledWith("u1");
  });

  it("is 404 when the row is gone", async () => {
    getUserById.mockResolvedValue(undefined);
    const res = await getUserHandler(request, "u1");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "User not found" });
  });

  it("forwards the auth response", async () => {
    const denied = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    auth.mockResolvedValue(denied);
    expect(await getUserHandler(request, "u1")).toBe(denied);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("is 500 on a database error", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    getUserById.mockRejectedValue(new Error("down"));
    const res = await getUserHandler(request, "u1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
