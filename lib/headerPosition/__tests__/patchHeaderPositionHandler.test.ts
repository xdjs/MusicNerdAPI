import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  canEdit: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: mock.canEdit }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

import { patchHeaderPositionHandler } from "@/lib/headerPosition/patchHeaderPositionHandler";

const artistId = "550e8400-e29b-41d4-a716-446655440000";
const validBody = { artistId, imageUrl: "https://example.com/photo.jpg", y: 50 };

describe("patchHeaderPositionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.auth.mockResolvedValue({ userId: "u1" });
    mock.canEdit.mockResolvedValue(true);
    mock.execute.mockResolvedValue([]);
  });

  it("returns 200 for a valid position update", async () => {
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify(validBody),
    });
    const response = await patchHeaderPositionHandler(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(mock.execute).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ artistId, imageUrl: "https://example.com/photo.jpg" }),
    });
    const response = await patchHeaderPositionHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 403 when not authorized", async () => {
    mock.canEdit.mockResolvedValueOnce(false);
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify(validBody),
    });
    const response = await patchHeaderPositionHandler(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "Not your artist" });
  });

  it("passes through 401 from auth", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify(validBody),
    });
    const response = await patchHeaderPositionHandler(request);
    expect(response.status).toBe(401);
  });

  it("includes CORS headers on success", async () => {
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify(validBody),
    });
    const response = await patchHeaderPositionHandler(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
