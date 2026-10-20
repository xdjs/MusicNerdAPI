import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
}));

const { getApprovedUGCCountHandler } =
  await import("@/lib/approvedUGCCount/getApprovedUGCCountHandler");

describe("getApprovedUGCCountHandler", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost/api/approvedUGCCount");
    const response = await getApprovedUGCCountHandler(request);
    expect(response.status).toBe(401);
  });
});
