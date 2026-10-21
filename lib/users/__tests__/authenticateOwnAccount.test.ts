import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
const { authenticateOwnAccount } = await import("@/lib/users/authenticateOwnAccount");

const request = new Request("https://x/api/user/u1");

beforeEach(() => {
  authenticateRequest.mockReset();
});

describe("authenticateOwnAccount", () => {
  it("passes when the token's user is the id in the path", async () => {
    authenticateRequest.mockResolvedValue({ userId: "u1" });
    expect(await authenticateOwnAccount(request, "u1")).toEqual({ userId: "u1" });
  });

  it("is 403 Forbidden for any other id, admins included", async () => {
    authenticateRequest.mockResolvedValue({ userId: "u1" });
    const res = await authenticateOwnAccount(request, "u2");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
    expect(await (res as NextResponse).json()).toEqual({ status: "error", error: "Forbidden" });
    expect((res as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the 401 when not signed in", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    authenticateRequest.mockResolvedValue(denied);
    expect(await authenticateOwnAccount(request, "u1")).toBe(denied);
  });
});
