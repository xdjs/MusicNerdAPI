import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  adminWrite: vi.fn(),
  claim: vi.fn(),
  fenced: vi.fn(),
  authenticateRequest: vi.fn(),
  canEditArtist: vi.fn(),
  isSupabaseStorageConfigured: vi.fn(),
  uploadStorageObject: vi.fn(),
  purgeStaleProfileImages: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.authenticateRequest }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEditArtist }));
vi.mock("@/lib/db/db", () => ({ db: { update: () => ({ set: m.set }) } }));
vi.mock("@/lib/artistImages/isSupabaseStorageConfigured", () => ({
  isSupabaseStorageConfigured: m.isSupabaseStorageConfigured,
}));
vi.mock("@/lib/storage/uploadStorageObject", () => ({
  uploadStorageObject: m.uploadStorageObject,
}));
vi.mock("@/lib/artistImages/purgeStaleProfileImages", () => ({
  purgeStaleProfileImages: m.purgeStaleProfileImages,
}));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: m.claim }));
vi.mock("@/lib/ownership/withArtistUploadWrite", () => ({ withArtistUploadWrite: m.fenced }));
vi.mock("@/lib/artistImages/withAdminProfileWrite", () => ({
  withAdminProfileWrite: m.adminWrite,
}));
const { postProfileImageHandler } = await import("@/lib/artistImages/postProfileImageHandler");

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const request = (fields: Record<string, string | File>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return new Request("https://api.test/api/artist/profile-image", { method: "POST", body: data });
};
const png = (bytes: Uint8Array<ArrayBuffer> = PNG, type = "image/png") =>
  new File([bytes], "me.png", { type });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1761000000000);
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  m.adminWrite
    .mockReset()
    .mockImplementation(async (_a, _u, write) => write({ update: () => ({ set: m.set }) }));
  m.claim.mockReset().mockResolvedValue("claim-1");
  m.fenced
    .mockReset()
    .mockImplementation(async (_artist, _user, _claim, write) =>
      write({ update: () => ({ set: m.set }) }),
    );
  m.authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  m.canEditArtist.mockReset().mockResolvedValue(true);
  m.isSupabaseStorageConfigured.mockReset().mockReturnValue(true);
  m.uploadStorageObject.mockReset().mockResolvedValue(undefined);
  m.purgeStaleProfileImages.mockReset().mockResolvedValue(undefined);
  m.set.mockReset().mockReturnValue({ where: m.where });
  m.where.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("postProfileImageHandler", () => {
  it("stores the image and fences publication without purging concurrent uploads", async () => {
    const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
    expect(response.status).toBe(200);
    const url = `https://test.supabase.co/storage/v1/object/public/vault-files/profile-images/${ARTIST}_1761000000000.png`;
    expect(await response.json()).toEqual({ status: "ok", success: true, imagePath: url });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const [bucket, path, body, options] = m.uploadStorageObject.mock.calls[0];
    expect(bucket).toBe("vault-files");
    expect(path).toBe(`profile-images/${ARTIST}_1761000000000.png`);
    expect(Buffer.from(body)).toEqual(Buffer.from(PNG));
    expect(options).toEqual({ contentType: "image/png", upsert: false, cacheControl: "3600" });
    expect(m.set).toHaveBeenCalledWith({ customImage: url });
    expect(m.purgeStaleProfileImages).not.toHaveBeenCalled();
    expect(m.fenced).toHaveBeenCalledWith(ARTIST, "u1", "claim-1", expect.any(Function));
  });

  it("forwards the auth error when not signed in", async () => {
    m.authenticateRequest.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postProfileImageHandler(request({ file: png(), artistId: ARTIST }))).status).toBe(
      401,
    );
  });

  it("answers a JSON 500 when signing in throws", async () => {
    m.authenticateRequest.mockRejectedValueOnce(new Error("db down"));
    const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Failed to upload image" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers 400 when the file or artist id is missing", async () => {
    const response = await postProfileImageHandler(request({ artistId: ARTIST }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "error",
      error: "File and artistId are required",
    });
    expect(m.canEditArtist).not.toHaveBeenCalled();
  });

  it("answers 403 for someone who is neither claimant nor admin, before reading the file", async () => {
    m.canEditArtist.mockResolvedValueOnce(false);
    const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    expect(m.uploadStorageObject).not.toHaveBeenCalled();
  });

  it("answers 400 for a file over 5MB, a type other than PNG/JPEG/WebP, or mismatched bytes", async () => {
    let response = await postProfileImageHandler(
      request({ file: png(new Uint8Array(5 * 1024 * 1024 + 1)), artistId: ARTIST }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "error", error: "Image too large (max 5MB)" });
    response = await postProfileImageHandler(
      request({ file: png(PNG, "image/gif"), artistId: ARTIST }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Only PNG, JPEG, and WebP images are supported",
    });
    response = await postProfileImageHandler(
      request({ file: png(PNG, "image/jpeg"), artistId: ARTIST }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Image content does not match declared type",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[artist/profile-image] rejected:",
      expect.objectContaining({ reason: "magic_byte_mismatch", header: "89 50 4e 47 0d 0a 1a 0a" }),
    );
    expect(m.uploadStorageObject).not.toHaveBeenCalled();
  });

  it("answers 503 when storage isn't configured", async () => {
    m.isSupabaseStorageConfigured.mockReturnValueOnce(false);
    const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error:
        "Image storage is not configured on this server (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    });
  });

  it("answers 500 when storage refuses the upload, without touching the artist", async () => {
    m.uploadStorageObject.mockRejectedValueOnce(new Error("Storage upload failed: HTTP 409"));
    const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Failed to upload image to storage",
    });
    expect(m.set).not.toHaveBeenCalled();
  });

  it("answers 500 on any other failure", async () => {
    m.where.mockRejectedValueOnce(new Error("db down"));
    const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Failed to upload image" });
  });
});

it("rejects a profile upload revoked while storage was running without publishing or deleting bytes", async () => {
  const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");
  m.fenced.mockRejectedValueOnce(new OwnershipChangedError());
  const response = await postProfileImageHandler(request({ file: png(), artistId: ARTIST }));
  expect(response.status).toBe(403);
  expect(m.fenced).toHaveBeenCalledWith(ARTIST, "u1", "claim-1", expect.any(Function));
  expect(m.set).not.toHaveBeenCalled();
  expect(m.purgeStaleProfileImages).not.toHaveBeenCalled();
});

it("does not grant profile authority to an unclaimed non-admin contributor", async () => {
  m.claim.mockResolvedValue(null);
  m.canEditArtist.mockResolvedValue(false);
  expect((await postProfileImageHandler(request({ file: png(), artistId: ARTIST }))).status).toBe(
    403,
  );
  expect(m.uploadStorageObject).not.toHaveBeenCalled();
});

it("retains original unclaimed admin profile authority with a final role fence", async () => {
  m.claim.mockResolvedValue(null);
  expect((await postProfileImageHandler(request({ file: png(), artistId: ARTIST }))).status).toBe(
    200,
  );
  expect(m.adminWrite).toHaveBeenCalledWith(ARTIST, "u1", expect.any(Function));
  expect(m.fenced).not.toHaveBeenCalled();
});
