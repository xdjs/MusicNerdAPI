import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({ edit: vi.fn(), claim: vi.fn(), source: vi.fn() }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({ validateArtistEditRequest: mock.edit }));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: mock.claim }));
vi.mock("@/lib/vault/getVaultSourceByIdAndArtist", () => ({
  getVaultSourceByIdAndArtist: mock.source,
}));
const { validateSourceEditRequest } = await import("@/lib/vaultSources/validateSourceEditRequest");

const artistId = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const sourceId = "2c6f1c6e-4f0a-4b9b-8a6a-3b1f0b2d9e71";
const request = new Request("https://api.test/x");

beforeEach(() => {
  vi.clearAllMocks();
  mock.edit.mockResolvedValue({ artistId, userId: "u1" });
  mock.claim.mockResolvedValue("c1");
  mock.source.mockResolvedValue({ id: sourceId, artistId });
});

describe("validateSourceEditRequest", () => {
  it("returns the caller, the source and the claim generation", async () => {
    expect(await validateSourceEditRequest(request, artistId, sourceId)).toEqual({
      artistId,
      userId: "u1",
      sourceId,
      claimId: "c1",
    });
    expect(mock.source).toHaveBeenCalledWith(sourceId, artistId);
  });

  it("passes on the artist check's response", async () => {
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.edit.mockResolvedValueOnce(denied);
    expect(await validateSourceEditRequest(request, artistId, sourceId)).toBe(denied);
  });

  it("is a 400 for a sourceId that isn't a UUID", async () => {
    const res = (await validateSourceEditRequest(request, artistId, "nope")) as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "sourceId must be a UUID" });
  });

  it("is a 404 when the source isn't the artist's", async () => {
    mock.source.mockResolvedValueOnce(undefined);
    const res = (await validateSourceEditRequest(request, artistId, sourceId)) as NextResponse;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Source not found" });
  });
});
