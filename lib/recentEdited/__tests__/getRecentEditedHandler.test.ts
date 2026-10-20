import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
  },
}));

const { getRecentEditedHandler } = await import("@/lib/recentEdited/getRecentEditedHandler");

describe("getRecentEditedHandler", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost/api/recentEdited");
    const response = await getRecentEditedHandler(request);
    expect(response.status).toBe(401);
  });

  it("returns 200 with array", async () => {
    const request = new Request("http://localhost/api/recentEdited");
    const response = await getRecentEditedHandler(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
