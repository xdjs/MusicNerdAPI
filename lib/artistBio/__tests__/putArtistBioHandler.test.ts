import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { putArtistBioHandler } from "@/lib/artistBio/putArtistBioHandler";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: mock.where,
      }),
    }),
  },
}));
vi.mock("@/lib/db/schema", () => ({
  artists: { id: "id" },
}));

const artistId = "50f23458-df64-4381-8042-7333e8b64531";
const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function put(body: unknown) {
  return new Request(`http://x/api/artistBio/${artistId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("putArtistBioHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.validate.mockResolvedValue({ artistId, userId });
    mock.where.mockResolvedValue(undefined);
  });

  it("returns 200 on valid update", async () => {
    const res = await putArtistBioHandler(put({ bio: "New bio text" }), artistId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 401/403 when validateArtistEditRequest fails", async () => {
    mock.validate.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not your artist" }, { status: 403 }),
    );
    const res = await putArtistBioHandler(put({ bio: "text" }), artistId);
    expect(res.status).toBe(403);
    expect(mock.where).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", async () => {
    const res = await putArtistBioHandler(put({}), artistId);
    expect(res.status).toBe(400);
  });

  it("returns 400 on extra fields (strict)", async () => {
    const res = await putArtistBioHandler(put({ bio: "text", extra: true }), artistId);
    expect(res.status).toBe(400);
  });

  it("returns 400 when bio exceeds max length", async () => {
    const res = await putArtistBioHandler(put({ bio: "x".repeat(15001) }), artistId);
    expect(res.status).toBe(400);
  });

  it("accepts bio at max length", async () => {
    const res = await putArtistBioHandler(put({ bio: "x".repeat(15000) }), artistId);
    expect(res.status).toBe(200);
  });

  it("has CORS headers on success", async () => {
    const res = await putArtistBioHandler(put({ bio: "text" }), artistId);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
