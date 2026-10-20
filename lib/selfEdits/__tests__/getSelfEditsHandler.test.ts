import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
}));

const { getSelfEditsHandler } = await import("@/lib/selfEdits/getSelfEditsHandler");

describe("getSelfEditsHandler", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost/api/selfEdits");
    const response = await getSelfEditsHandler(request);
    expect(response.status).toBe(401);
  });
});
