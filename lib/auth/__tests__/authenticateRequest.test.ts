import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { verify, getUser } = vi.hoisted(() => ({ verify: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({ verifyPrivyAccessToken: verify }));
vi.mock("@/lib/auth/getUserByPrivyId", () => ({ getUserByPrivyId: getUser }));
const { authenticateRequest } = await import("@/lib/auth/authenticateRequest");

const req = (auth?: string) =>
  new Request("https://x/y", { method: "POST", headers: auth ? { Authorization: auth } : {} });

beforeEach(() => {
  verify.mockReset();
  getUser.mockReset();
});

describe("authenticateRequest", () => {
  it("resolves a valid Privy token to the Music Nerd user id", async () => {
    verify.mockResolvedValueOnce("did:privy:abc");
    getUser.mockResolvedValueOnce({ id: "u1", isAdmin: false });
    expect(await authenticateRequest(req("Bearer tok"))).toEqual({ userId: "u1" });
    expect(verify).toHaveBeenCalledWith("tok");
    expect(getUser).toHaveBeenCalledWith("did:privy:abc");
  });

  it.each([
    ["no token", undefined, null, undefined],
    ["an invalid token", "Bearer bad", null, undefined],
    ["a Privy account that never signed in to Music Nerd", "Bearer tok", "did:privy:x", undefined],
  ])("is a 401 for %s", async (_label, auth, privyId, user) => {
    verify.mockResolvedValueOnce(privyId);
    getUser.mockResolvedValueOnce(user);
    const res = await authenticateRequest(req(auth));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
    expect(await (res as NextResponse).json()).toEqual({ status: "error", error: "Not signed in" });
    expect((res as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
