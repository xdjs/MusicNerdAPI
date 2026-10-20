import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

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

import { patchPhotoChoiceHandler } from "@/lib/photoChoice/patchPhotoChoiceHandler";

const artistId = "50f23458-df64-4381-8042-7333e8b64531";
const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function patch(body: unknown) {
  return new Request("http://x/api/artist/photo-choice", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("patchPhotoChoiceHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.auth.mockResolvedValue({ userId });
    mock.canEdit.mockResolvedValue(true);
    mock.execute.mockResolvedValue(undefined);
  });

  it("returns 200 on valid update", async () => {
    const res = await patchPhotoChoiceHandler(
      patch({ artistId, customImage: "https://example.com/photo.jpg" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.execute).toHaveBeenCalledOnce();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("accepts null to clear the image", async () => {
    const res = await patchPhotoChoiceHandler(
      patch({ artistId, customImage: null }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 401 when not signed in", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await patchPhotoChoiceHandler(
      patch({ artistId, customImage: null }),
    );
    expect(res.status).toBe(401);
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", async () => {
    const res = await patchPhotoChoiceHandler(patch({ artistId: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on extra fields (strict)", async () => {
    const res = await patchPhotoChoiceHandler(
      patch({ artistId, customImage: null, extra: true }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when user cannot edit artist", async () => {
    mock.canEdit.mockResolvedValue(false);
    const res = await patchPhotoChoiceHandler(
      patch({ artistId, customImage: "https://example.com/photo.jpg" }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Not your artist" });
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mock.execute.mockRejectedValue(new Error("db down"));
    const res = await patchPhotoChoiceHandler(
      patch({ artistId, customImage: null }),
    );
    expect(res.status).toBe(500);
  });
});
