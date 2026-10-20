import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/db/db", () => ({
  db: {
    query: { artistVaultSources: { findFirst: mock.findFirst } },
    insert: mock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
  },
}));
vi.mock("@/lib/db/schema", () => ({
  artistVaultSources: { artistId: "artist_id", url: "url" },
}));

import { postLoreSuggestionsHandler } from "@/lib/loreSuggestions/postLoreSuggestionsHandler";

const artistId = "550e8400-e29b-41d4-a716-446655440000";

describe("postLoreSuggestionsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.auth.mockResolvedValue({ userId: "u1" });
    mock.findFirst.mockResolvedValue(null);
    mock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
  });

  it("returns 201 for a new suggestion", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    const response = await postLoreSuggestionsHandler(request, artistId);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(mock.insert).toHaveBeenCalledOnce();
  });

  it("returns 409 for a duplicate source", async () => {
    mock.findFirst.mockResolvedValueOnce({ id: "existing" });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    const response = await postLoreSuggestionsHandler(request, artistId);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "Source already exists" });
  });

  it("returns 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await postLoreSuggestionsHandler(request, artistId);
    expect(response.status).toBe(400);
  });

  it("passes through 401 from auth", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    const response = await postLoreSuggestionsHandler(request, artistId);
    expect(response.status).toBe(401);
  });

  it("includes CORS headers on success", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/article" }),
    });
    const response = await postLoreSuggestionsHandler(request, artistId);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
