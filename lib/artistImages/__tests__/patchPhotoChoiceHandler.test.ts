import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  canEditArtist: vi.fn(),
  findFirst: vi.fn(),
  findApprovedClaim: vi.fn(),
  getProviderPhoto: vi.fn(),
  withScopedArtistWrite: vi.fn(),
  trackServerEvent: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.authenticateRequest }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEditArtist }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artists: { findFirst: m.findFirst } } } }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.findApprovedClaim }));
vi.mock("@/lib/artistImages/getProviderPhoto", () => ({ getProviderPhoto: m.getProviderPhoto }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({
  withScopedArtistWrite: m.withScopedArtistWrite,
}));
vi.mock("@/lib/analytics/trackServerEvent", () => ({ trackServerEvent: m.trackServerEvent }));
const { patchPhotoChoiceHandler } = await import("@/lib/artistImages/patchPhotoChoiceHandler");
const { getArtistOperationOwnership } = await import("@/lib/ownership/getArtistOperationOwnership");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const RESOLVED = "https://cdn.deezer/xl.jpg";
const body = {
  artistId: ARTIST,
  source: "deezer",
  imageUrl: RESOLVED,
  expectedCustomImage: "https://old/x.jpg",
  providerId: "5590",
};
const request = (b: unknown = body) =>
  new Request("https://api.test/api/artist/photo-choice", {
    method: "PATCH",
    body: typeof b === "string" ? b : JSON.stringify(b),
  });
const artist = { id: ARTIST, deezer: " 5590 ", spotify: null, customImage: "https://old/x.jpg" };
let seenOwnership: unknown;
const tx = { update: vi.fn(() => ({ set: m.set })) };

beforeEach(() => {
  m.authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  m.canEditArtist.mockReset().mockResolvedValue(true);
  m.findFirst.mockReset().mockResolvedValue(artist);
  m.findApprovedClaim.mockReset().mockResolvedValue({ id: "c1", userId: "u1" });
  m.getProviderPhoto.mockReset().mockResolvedValue(RESOLVED);
  m.trackServerEvent.mockReset().mockResolvedValue(undefined);
  m.set.mockReset().mockReturnValue({ where: m.where });
  m.where.mockReset().mockReturnValue({ returning: m.returning });
  m.returning.mockReset().mockResolvedValue([{ imagePath: RESOLVED, position: null }]);
  tx.update.mockClear();
  seenOwnership = undefined;
  m.withScopedArtistWrite.mockReset().mockImplementation(async (artistId, write) => {
    seenOwnership = getArtistOperationOwnership(artistId);
    return write(tx);
  });
});

describe("patchPhotoChoiceHandler", () => {
  it("saves the re-resolved provider photo under the ownership fence and reports the edit", async () => {
    const response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      success: true,
      imagePath: RESOLVED,
      position: 0,
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(seenOwnership).toEqual({ artistId: ARTIST, userId: "u1", expectedClaimId: "c1" });
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({ customImage: RESOLVED, headerImagePosition: expect.anything() }),
    );
    expect(m.trackServerEvent).toHaveBeenCalledWith("profile_edit", {
      action: "photo",
      target: null,
    });
  });

  it("keeps a header position that was set for this same image", async () => {
    m.returning.mockResolvedValueOnce([
      { imagePath: RESOLVED, position: { imageUrl: RESOLVED, y: 42 } },
    ]);
    expect(await (await patchPhotoChoiceHandler(request())).json()).toMatchObject({
      position: 42,
    });
  });

  it("forwards the auth error when not signed in", async () => {
    m.authenticateRequest.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await patchPhotoChoiceHandler(request())).status).toBe(401);
  });

  it("answers 400 for a bad body", async () => {
    const response = await patchPhotoChoiceHandler(request({ ...body, source: "apple" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "error", error: "Invalid photo choice" });
    expect(m.canEditArtist).not.toHaveBeenCalled();
  });

  it("answers 403 for someone who is neither claimant nor admin", async () => {
    m.canEditArtist.mockResolvedValueOnce(false);
    const response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    expect(m.withScopedArtistWrite).not.toHaveBeenCalled();
  });

  it("answers 404 when the artist does not exist", async () => {
    m.findFirst.mockResolvedValueOnce(undefined);
    expect((await patchPhotoChoiceHandler(request())).status).toBe(404);
  });

  it("answers 409 when the current photo or the provider id differ from what the caller saw", async () => {
    m.findFirst.mockResolvedValueOnce({ ...artist, customImage: null });
    let response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      status: "error",
      error: "The profile changed. Close and reopen photo choices.",
    });
    m.findFirst.mockResolvedValueOnce({ ...artist, deezer: "9" });
    response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(409);
    expect(m.getProviderPhoto).not.toHaveBeenCalled();
  });

  it("answers 503 when the provider has no photo now, and 409 when it differs from the choice", async () => {
    m.getProviderPhoto.mockResolvedValueOnce(null);
    let response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error: "That photo is unavailable. Your current photo is unchanged.",
    });
    m.getProviderPhoto.mockResolvedValueOnce("https://cdn.deezer/new.jpg");
    response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      status: "error",
      error: "That provider photo changed. Close and reopen photo choices.",
    });
    expect(m.withScopedArtistWrite).not.toHaveBeenCalled();
  });

  it("answers 409 when the guarded update matched no row", async () => {
    m.returning.mockResolvedValueOnce([]);
    const response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(409);
    expect(m.trackServerEvent).not.toHaveBeenCalled();
  });

  it("answers 403 when ownership changed during the write, 500 on any other failure", async () => {
    m.withScopedArtistWrite.mockRejectedValueOnce(new OwnershipChangedError());
    let response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: "error", error: "Artist ownership changed" });
    m.withScopedArtistWrite.mockRejectedValueOnce(new Error("db down"));
    response = await patchPhotoChoiceHandler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not save photo. Your current photo is unchanged.",
    });
  });
});
