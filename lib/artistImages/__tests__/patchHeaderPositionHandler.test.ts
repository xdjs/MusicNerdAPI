import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  canEditArtist: vi.fn(),
  findApprovedClaim: vi.fn(),
  withScopedArtistWrite: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.authenticateRequest }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEditArtist }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.findApprovedClaim }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({
  withScopedArtistWrite: m.withScopedArtistWrite,
}));
const { patchHeaderPositionHandler } =
  await import("@/lib/artistImages/patchHeaderPositionHandler");
const { getArtistOperationOwnership } = await import("@/lib/ownership/getArtistOperationOwnership");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const body = { artistId: ARTIST, imageUrl: "https://cdn.deezer/xl.jpg", y: 35 };
const request = (b: unknown = body) =>
  new Request("https://api.test/api/artist/header-position", {
    method: "PATCH",
    body: JSON.stringify(b),
  });
let seenOwnership: unknown;
const tx = { update: vi.fn(() => ({ set: m.set })) };

beforeEach(() => {
  m.authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  m.canEditArtist.mockReset().mockResolvedValue(true);
  m.findApprovedClaim.mockReset().mockResolvedValue(undefined);
  m.set.mockReset().mockReturnValue({ where: m.where });
  m.where.mockReset().mockReturnValue({ returning: m.returning });
  m.returning.mockReset().mockResolvedValue([{ id: ARTIST }]);
  tx.update.mockClear();
  seenOwnership = undefined;
  m.withScopedArtistWrite.mockReset().mockImplementation(async (artistId, write) => {
    seenOwnership = getArtistOperationOwnership(artistId);
    return write(tx);
  });
});

describe("patchHeaderPositionHandler", () => {
  it("saves the position for the image under the ownership fence (unclaimed artist, admin)", async () => {
    const response = await patchHeaderPositionHandler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", success: true });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(seenOwnership).toEqual({ artistId: ARTIST, userId: "u1", expectedClaimId: null });
    expect(m.set).toHaveBeenCalledWith({
      headerImagePosition: { imageUrl: "https://cdn.deezer/xl.jpg", y: 35 },
    });
  });

  it("carries the approved claim as the expected generation", async () => {
    m.findApprovedClaim.mockResolvedValueOnce({ id: "c1", userId: "u1" });
    await patchHeaderPositionHandler(request());
    expect(seenOwnership).toMatchObject({ expectedClaimId: "c1" });
  });

  it("forwards the auth error when not signed in", async () => {
    m.authenticateRequest.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await patchHeaderPositionHandler(request())).status).toBe(401);
  });

  it("answers a JSON 500 when signing in throws", async () => {
    m.authenticateRequest.mockRejectedValueOnce(new Error("db down"));
    const response = await patchHeaderPositionHandler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not save photo position",
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers 400 for a bad body", async () => {
    const response = await patchHeaderPositionHandler(request({ ...body, y: 101 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "error", error: "Invalid photo position" });
    expect(m.canEditArtist).not.toHaveBeenCalled();
  });

  it("answers 403 for someone who is neither claimant nor admin", async () => {
    m.canEditArtist.mockResolvedValueOnce(false);
    const response = await patchHeaderPositionHandler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    expect(m.withScopedArtistWrite).not.toHaveBeenCalled();
  });

  it("answers 404 when no row was updated", async () => {
    m.returning.mockResolvedValueOnce([]);
    const response = await patchHeaderPositionHandler(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "error", error: "Artist not found" });
  });

  it("answers 403 when ownership changed during the write, 500 on any other failure", async () => {
    m.withScopedArtistWrite.mockRejectedValueOnce(new OwnershipChangedError());
    let response = await patchHeaderPositionHandler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: "error", error: "Artist ownership changed" });
    m.withScopedArtistWrite.mockRejectedValueOnce(new Error("db down"));
    response = await patchHeaderPositionHandler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not save photo position",
    });
  });
});
