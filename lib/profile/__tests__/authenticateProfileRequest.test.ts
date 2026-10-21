import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
const { authenticateProfileRequest } = await import("@/lib/profile/authenticateProfileRequest");

const request = (account?: string) =>
  new Request("https://x/api/profile/summary", {
    headers: account ? { "X-Profile-Account": account } : {},
  });

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
});

describe("authenticateProfileRequest", () => {
  it("passes when X-Profile-Account is the token's user", async () => {
    expect(await authenticateProfileRequest(request("u1"))).toEqual({ userId: "u1" });
  });

  it.each([
    ["another account", "u2"],
    ["no header", undefined],
  ])("is 409 for %s", async (_label, account) => {
    const res = await authenticateProfileRequest(request(account));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(409);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Account changed. Refresh and try again.",
    });
    expect((res as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the 401 when not signed in", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    authenticateRequest.mockResolvedValue(denied);
    expect(await authenticateProfileRequest(request("u1"))).toBe(denied);
  });
});
