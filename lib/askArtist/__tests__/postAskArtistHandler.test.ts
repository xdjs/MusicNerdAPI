import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
}));

const { postAskArtistHandler } = await import("@/lib/askArtist/postAskArtistHandler");

describe("postAskArtistHandler", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost/api/askArtist", {
      method: "POST",
      body: JSON.stringify({ artistId: "a1", question: "Who?" }),
    });
    const response = await postAskArtistHandler(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for missing artistId", async () => {
    const request = new Request("http://localhost/api/askArtist", {
      method: "POST",
      body: JSON.stringify({ question: "Who?" }),
    });
    const response = await postAskArtistHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing question", async () => {
    const request = new Request("http://localhost/api/askArtist", {
      method: "POST",
      body: JSON.stringify({ artistId: "a1" }),
    });
    const response = await postAskArtistHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 501 stub response", async () => {
    const request = new Request("http://localhost/api/askArtist", {
      method: "POST",
      body: JSON.stringify({ artistId: "a1", question: "Who is this?" }),
    });
    const response = await postAskArtistHandler(request);
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toContain("not yet migrated");
  });
});
