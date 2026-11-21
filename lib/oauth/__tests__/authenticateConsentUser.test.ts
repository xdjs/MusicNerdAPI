import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ verify: vi.fn(), findOrCreate: vi.fn() }));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({ verifyPrivyAccessToken: mock.verify }));
vi.mock("@/lib/users/findOrCreateUserByPrivyId", () => ({
  findOrCreateUserByPrivyId: mock.findOrCreate,
}));
const { authenticateConsentUser } = await import("@/lib/oauth/authenticateConsentUser");

const request = (auth?: string) =>
  new Request("https://api.musicnerd.net/api/oauth/consent", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });

beforeEach(() => vi.clearAllMocks());

describe("authenticateConsentUser", () => {
  it("returns the Music Nerd user, created on first sign-in", async () => {
    mock.verify.mockResolvedValue("did:privy:x");
    mock.findOrCreate.mockResolvedValue({ id: "user-1" });
    expect(await authenticateConsentUser(request("Bearer privy-token"))).toEqual({
      userId: "user-1",
    });
    expect(mock.verify).toHaveBeenCalledWith("privy-token");
    expect(mock.findOrCreate).toHaveBeenCalledWith("did:privy:x");
  });

  it.each([
    ["no token", undefined],
    ["an invalid token", "Bearer bad"],
  ])("is a 401 for %s", async (_label, auth) => {
    mock.verify.mockResolvedValue(null);
    const res = await authenticateConsentUser(request(auth));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
    expect(await (res as NextResponse).json()).toEqual({ status: "error", error: "Not signed in" });
    expect(mock.findOrCreate).not.toHaveBeenCalled();
  });
});
