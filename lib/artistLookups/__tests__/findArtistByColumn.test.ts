import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
vi.mock("@/lib/db/db", () => ({
  db: { select: () => ({ from: () => ({ where }) }) },
}));
const { findArtistByColumn } = await import("@/lib/artistLookups/findArtistByColumn");
const { lookupArtists } = await import("@/lib/artistLookups/lookupArtists");

beforeEach(() => vi.clearAllMocks());

describe("findArtistByColumn", () => {
  it("returns the first row whose column equals the value", async () => {
    limit.mockResolvedValueOnce([{ id: "a1" }]);
    expect(await findArtistByColumn(lookupArtists.spotify, "sp1")).toEqual({ id: "a1" });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("returns undefined when nothing matches", async () => {
    limit.mockResolvedValueOnce([]);
    expect(await findArtistByColumn(lookupArtists.instagram, "nobody")).toBeUndefined();
  });

  it("throws on a database error, so callers can answer 500 rather than 404", async () => {
    limit.mockRejectedValueOnce(new Error("pool"));
    await expect(findArtistByColumn(lookupArtists.spotify, "sp1")).rejects.toThrow("pool");
  });
});
