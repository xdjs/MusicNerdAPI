import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  getArtist: vi.fn(),
}));

vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: mock.auth,
}));
vi.mock("@/lib/artists/getArtistById", () => ({
  getArtistById: mock.getArtist,
}));

// eslint-disable-next-line import/first
import { getArtistBioHandler } from "@/lib/artistBio/getArtistBioHandler";

const artistId = "50f23458-df64-4381-8042-7333e8b64531";
const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function get() {
  return new Request(`http://x/api/artistBio/${artistId}`);
}

describe("getArtistBioHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.auth.mockResolvedValue({ userId });
    mock.getArtist.mockResolvedValue({ id: artistId, bio: "A great artist." });
  });

  it("returns 200 with the bio", async () => {
    const res = await getArtistBioHandler(get(), artistId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", bio: "A great artist." });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns null when bio is not set", async () => {
    mock.getArtist.mockResolvedValue({ id: artistId, bio: null });
    const res = await getArtistBioHandler(get(), artistId);
    expect(await res.json()).toEqual({ status: "ok", bio: null });
  });

  it("returns null when bio is undefined", async () => {
    mock.getArtist.mockResolvedValue({ id: artistId });
    const res = await getArtistBioHandler(get(), artistId);
    expect(await res.json()).toEqual({ status: "ok", bio: null });
  });

  it("returns 400 when id is not a UUID", async () => {
    const res = await getArtistBioHandler(get(), "not-a-uuid");
    expect(res.status).toBe(400);
    expect(mock.getArtist).not.toHaveBeenCalled();
  });

  it("returns 401 when not signed in", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await getArtistBioHandler(get(), artistId);
    expect(res.status).toBe(401);
  });

  it("returns 404 when artist does not exist", async () => {
    mock.getArtist.mockResolvedValue(undefined);
    const res = await getArtistBioHandler(get(), artistId);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "Artist not found" });
  });

  it("has CORS headers on error responses", async () => {
    mock.getArtist.mockResolvedValue(undefined);
    const res = await getArtistBioHandler(get(), artistId);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
