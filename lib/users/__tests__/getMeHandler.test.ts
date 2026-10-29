import { beforeEach, describe, expect, it, vi } from "vitest";

const { verify, findOrCreate, assign } = vi.hoisted(() => ({
  verify: vi.fn(),
  findOrCreate: vi.fn(),
  assign: vi.fn(),
}));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({ verifyPrivyAccessToken: verify }));
vi.mock("@/lib/users/findOrCreateUserByPrivyId", () => ({
  findOrCreateUserByPrivyId: findOrCreate,
}));
vi.mock("@/lib/users/assignUserName", () => ({ assignUserName: assign }));
const { getMeHandler } = await import("@/lib/users/getMeHandler");

const request = (auth?: string) =>
  new Request("https://x/api/user/me", { headers: auth ? { Authorization: auth } : {} });
const user = {
  id: "u1",
  email: null,
  username: "Vinyl Otter",
  usernameNeedsConfirmation: true,
  usernamePromptedAt: null,
  wallet: null,
  privyUserId: "did:privy:x",
  createdAt: "2026-10-01 12:00:00+00",
  updatedAt: "2026-10-01 12:00:00+00",
  legacyId: null,
  isAdmin: true,
  isWhiteListed: false,
  isSuperAdmin: false,
  isHidden: false,
  legacyLinkDismissed: false,
  acceptedUgcCount: 3,
};

beforeEach(() => {
  verify.mockReset().mockResolvedValue("did:privy:x");
  findOrCreate.mockReset().mockResolvedValue(user);
  assign.mockReset().mockImplementation(async (u: unknown) => u);
});

describe("getMeHandler", () => {
  it("returns the caller's row and needsLegacyLink with CORS headers", async () => {
    const res = await getMeHandler(request("Bearer tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...user, needsLegacyLink: true });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(verify).toHaveBeenCalledWith("tok");
    expect(findOrCreate).toHaveBeenCalledWith("did:privy:x");
    expect(assign).toHaveBeenCalledWith(user);
  });

  it.each([
    ["a wallet", { wallet: "0xabc" }],
    ["a dismissed prompt", { legacyLinkDismissed: true }],
  ])("has needsLegacyLink false for an account with %s", async (_label, change) => {
    findOrCreate.mockResolvedValue({ ...user, ...change });
    const res = await getMeHandler(request("Bearer tok"));
    expect((await res.json()).needsLegacyLink).toBe(false);
  });

  it("returns the generated name", async () => {
    assign.mockResolvedValue({ ...user, username: "Tape Moth" });
    const res = await getMeHandler(request("Bearer tok"));
    expect((await res.json()).username).toBe("Tape Moth");
  });

  it.each([
    ["no token", undefined],
    ["an invalid token", "Bearer bad"],
  ])("is 401 for %s", async (_label, auth) => {
    verify.mockResolvedValue(null);
    const res = await getMeHandler(request(auth));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", error: "Not signed in" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(findOrCreate).not.toHaveBeenCalled();
  });

  it("is 500 on a database error", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    findOrCreate.mockRejectedValue(new Error("down"));
    const res = await getMeHandler(request("Bearer tok"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
