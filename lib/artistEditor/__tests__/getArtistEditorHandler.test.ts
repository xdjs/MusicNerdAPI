import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getArtistEditorHandler } from "@/lib/artistEditor/getArtistEditorHandler";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  artist: vi.fn(),
  sources: vi.fn(),
  contributors: vi.fn(),
}));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.artist }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({ getVaultSourcesByStatus: mock.sources }));
vi.mock("@/lib/artistEditor/addSourceContributors", () => ({
  addSourceContributors: mock.contributors,
}));

const artistId = "00000000-0000-4000-8000-000000000001";
const request = () => new Request(`https://api.musicnerd.test/api/artist/${artistId}/editor`);

beforeEach(() => {
  vi.resetAllMocks();
  mock.validate.mockResolvedValue({ artistId, userId: "u1" });
  mock.artist.mockResolvedValue({ id: artistId, bio: "Salsa from Richmond." });
  mock.sources.mockImplementation(async (_id: string, status: string) => [{ id: `${status}-1` }]);
  mock.contributors.mockImplementation(async (_id: string, sources: { id: string }[]) =>
    sources.map(s => ({ ...s, contributorName: null })),
  );
});

describe("getArtistEditorHandler", () => {
  it("returns the stored About and every approved and pending source with contributors", async () => {
    const res = await getArtistEditorHandler(request(), artistId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      bio: "Salsa from Richmond.",
      approvedSources: [{ id: "approved-1", contributorName: null }],
      pendingSources: [{ id: "pending-1", contributorName: null }],
    });
    expect(mock.contributors).toHaveBeenCalledWith(artistId, [
      { id: "approved-1" },
      { id: "pending-1" },
    ]);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the claimant-or-admin check's response", async () => {
    mock.validate.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not your artist" }, { status: 403 }),
    );
    expect((await getArtistEditorHandler(request(), artistId)).status).toBe(403);
    expect(mock.sources).not.toHaveBeenCalled();
  });

  it("answers 404 for an artist that doesn't exist", async () => {
    mock.artist.mockResolvedValueOnce(undefined);
    const res = await getArtistEditorHandler(request(), artistId);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Artist not found" });
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.artist.mockRejectedValueOnce(new Error("db down"));
    const res = await getArtistEditorHandler(request(), artistId);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
