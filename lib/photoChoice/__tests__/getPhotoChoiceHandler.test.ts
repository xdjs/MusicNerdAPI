import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getPhotoChoiceHandler } from "@/lib/photoChoice/getPhotoChoiceHandler";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  canEdit: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: mock.auth,
}));
vi.mock("@/lib/auth/canEditArtist", () => ({
  canEditArtist: mock.canEdit,
}));
vi.mock("@/lib/db/db", () => ({
  db: { execute: mock.execute },
}));

const artistId = "50f23458-df64-4381-8042-7333e8b64531";
const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function get(query = `artistId=${artistId}`) {
  return new Request(`http://x/api/artist/photo-choice?${query}`);
}

describe("getPhotoChoiceHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.auth.mockResolvedValue({ userId });
    mock.canEdit.mockResolvedValue(true);
    mock.execute.mockResolvedValue([{ customImage: "https://example.com/img.jpg" }]);
  });

  it("returns 200 with the custom image", async () => {
    const res = await getPhotoChoiceHandler(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", customImage: "https://example.com/img.jpg" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns null when no custom image is set", async () => {
    mock.execute.mockResolvedValue([{ customImage: null }]);
    const res = await getPhotoChoiceHandler(get());
    expect(await res.json()).toEqual({ status: "ok", customImage: null });
  });

  it("returns null when artist has no row", async () => {
    mock.execute.mockResolvedValue([]);
    const res = await getPhotoChoiceHandler(get());
    expect(await res.json()).toEqual({ status: "ok", customImage: null });
  });

  it("returns 401 when not signed in", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await getPhotoChoiceHandler(get());
    expect(res.status).toBe(401);
  });

  it("returns 400 when artistId is missing", async () => {
    const res = await getPhotoChoiceHandler(get(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when artistId is not a UUID", async () => {
    const res = await getPhotoChoiceHandler(get("artistId=not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user cannot edit artist", async () => {
    mock.canEdit.mockResolvedValue(false);
    const res = await getPhotoChoiceHandler(get());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Not your artist" });
  });

  it("has CORS headers on success", async () => {
    const res = await getPhotoChoiceHandler(get());
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
