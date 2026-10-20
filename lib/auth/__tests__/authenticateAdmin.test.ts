import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { verify, getUser } = vi.hoisted(() => ({ verify: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({ verifyPrivyAccessToken: verify }));
vi.mock("@/lib/auth/getUserByPrivyId", () => ({ getUserByPrivyId: getUser }));
const { authenticateAdmin } = await import("@/lib/auth/authenticateAdmin");

const req = (auth?: string) =>
  new Request("https://x/y", { headers: auth ? { Authorization: auth } : {} });

beforeEach(() => {
  verify.mockReset();
  getUser.mockReset();
});

describe("authenticateAdmin", () => {
  it("resolves an admin's token to their user id", async () => {
    verify.mockResolvedValueOnce("did:privy:a");
    getUser.mockResolvedValueOnce({ id: "u1", isAdmin: true });
    expect(await authenticateAdmin(req("Bearer tok"))).toEqual({ userId: "u1" });
  });

  it("is a 401 with no token", async () => {
    const res = (await authenticateAdmin(req())) as NextResponse;
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", error: "Not signed in" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("is a 401 for an unknown Privy account", async () => {
    verify.mockResolvedValueOnce("did:privy:x");
    getUser.mockResolvedValueOnce(undefined);
    expect(((await authenticateAdmin(req("Bearer tok"))) as NextResponse).status).toBe(401);
  });

  it("is a 403 for a signed-in non-admin", async () => {
    verify.mockResolvedValueOnce("did:privy:b");
    getUser.mockResolvedValueOnce({ id: "u2", isAdmin: false });
    const res = (await authenticateAdmin(req("Bearer tok"))) as NextResponse;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Admin access required" });
  });
});
