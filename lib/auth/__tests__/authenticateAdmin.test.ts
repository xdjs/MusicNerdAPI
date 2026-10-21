import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticate, findFirst } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  findFirst: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: authenticate }));
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst } } } }));
const { authenticateAdmin } = await import("@/lib/auth/authenticateAdmin");

const req = () => new Request("https://x/y", { method: "POST" });

beforeEach(() => {
  authenticate.mockReset();
  findFirst.mockReset();
});

describe("authenticateAdmin", () => {
  it("resolves an admin to their user id", async () => {
    authenticate.mockResolvedValueOnce({ userId: "u1" });
    findFirst.mockResolvedValueOnce({ isAdmin: true });
    expect(await authenticateAdmin(req())).toEqual({ userId: "u1" });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ columns: { isAdmin: true } }));
  });

  it("passes authenticateRequest's 401 through untouched", async () => {
    const unauthorized = NextResponse.json(
      { status: "error", error: "Not signed in" },
      { status: 401 },
    );
    authenticate.mockResolvedValueOnce(unauthorized);
    expect(await authenticateAdmin(req())).toBe(unauthorized);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["a signed-in user who is not an admin", { isAdmin: false }],
    ["a user row that has gone missing", undefined],
  ])("is a 403 for %s", async (_label, user) => {
    authenticate.mockResolvedValueOnce({ userId: "u1" });
    findFirst.mockResolvedValueOnce(user);
    const res = await authenticateAdmin(req());
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
    expect(await (res as NextResponse).json()).toEqual({ status: "error", error: "Forbidden" });
    expect((res as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
