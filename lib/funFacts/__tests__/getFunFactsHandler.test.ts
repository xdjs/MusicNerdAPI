import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
}));
vi.mock("@/lib/ai/generateText", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Fun fact about the artist" }),
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

const { getFunFactsHandler } = await import("@/lib/funFacts/getFunFactsHandler");

describe("getFunFactsHandler", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost/api/funFacts/surprise?id=a1");
    const response = await getFunFactsHandler(request, "surprise");
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid type", async () => {
    const request = new Request("http://localhost/api/funFacts/invalid?id=a1");
    const response = await getFunFactsHandler(request, "invalid");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid fun fact type");
  });

  it("returns 400 when id param is missing", async () => {
    const request = new Request("http://localhost/api/funFacts/surprise");
    const response = await getFunFactsHandler(request, "surprise");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("id query parameter");
  });
});
