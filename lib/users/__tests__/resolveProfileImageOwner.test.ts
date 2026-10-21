import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

const { getUserById } = vi.hoisted(() => ({ getUserById: vi.fn() }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById }));
const { resolveProfileImageOwner } = await import("@/lib/users/resolveProfileImageOwner");

const request = (account?: string) =>
  new Request("https://x/api/user/profile-image", {
    headers: account ? { "X-Profile-Account": account } : {},
  });

beforeEach(() => {
  getUserById.mockReset();
});

describe("resolveProfileImageOwner", () => {
  it("names a Privy account's folder by the hash of its Privy id", async () => {
    getUserById.mockResolvedValue({ id: "u1", privyUserId: "did:privy:x" });
    expect(await resolveProfileImageOwner(request(), "u1")).toEqual({
      owner: { id: "u1", privyUserId: "did:privy:x" },
      folder: `identity-${createHash("sha256").update("did:privy:x").digest("hex")}`,
    });
    expect(getUserById).toHaveBeenCalledWith("u1");
  });

  it("names a wallet-only account's folder by its id", async () => {
    getUserById.mockResolvedValue({ id: "u1", privyUserId: null });
    expect(
      (await resolveProfileImageOwner(request("u1"), "u1")) as { folder: string },
    ).toMatchObject({
      folder: "u1",
    });
  });

  it("is 401 Account not found when the row is gone", async () => {
    getUserById.mockResolvedValue(undefined);
    const res = (await resolveProfileImageOwner(request(), "u1")) as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", error: "Account not found" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("is 409 when X-Profile-Account names another account", async () => {
    getUserById.mockResolvedValue({ id: "u1", privyUserId: null });
    const res = (await resolveProfileImageOwner(request("u2"), "u1")) as NextResponse;
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Your account changed. Refresh and try again.",
    });
  });
});
