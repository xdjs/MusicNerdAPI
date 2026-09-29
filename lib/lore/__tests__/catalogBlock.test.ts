import { describe, it, expect, vi, beforeEach } from "vitest";

const getSpotifyHeaders = vi.fn();
const getSpotifyCatalogDetail = vi.fn();
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({
  getSpotifyHeaders: () => getSpotifyHeaders(),
}));
vi.mock("@/lib/spotify/getSpotifyCatalogDetail", () => ({
  getSpotifyCatalogDetail: (...a: unknown[]) => getSpotifyCatalogDetail(...a),
}));
const { catalogBlock } = await import("@/lib/lore/catalogBlock");

beforeEach(() => {
  vi.clearAllMocks();
  getSpotifyHeaders.mockResolvedValue({ headers: { Authorization: "Bearer t" } });
});

describe("catalogBlock", () => {
  it("lists releases as reference data the model must never cite", async () => {
    getSpotifyCatalogDetail.mockResolvedValueOnce([
      { name: "rush", releaseDate: "2026-03-01", kind: "single", url: null },
      { name: "Undated", releaseDate: null, kind: null, url: null },
    ]);
    const block = await catalogBlock("spot123");
    expect(getSpotifyCatalogDetail).toHaveBeenCalledWith("spot123", {
      headers: { Authorization: "Bearer t" },
    });
    expect(block).toContain("VERIFIED CATALOG");
    expect(block).toContain("Never cite it.");
    expect(block).toContain("2026-03-01   single      rush");
    expect(block).toContain("date unknown release     Undated");
  });

  it("caps the catalog at forty lines", async () => {
    getSpotifyCatalogDetail.mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => ({
        name: `R${i}`,
        releaseDate: "2020-01-01",
        kind: "album",
        url: null,
      })),
    );
    const block = (await catalogBlock("s")) ?? "";
    expect(block).toContain("R39");
    expect(block).not.toContain("R40");
  });

  it("is null with an empty catalog, and never throws when Spotify is unavailable", async () => {
    getSpotifyCatalogDetail.mockResolvedValueOnce([]);
    expect(await catalogBlock("s")).toBeNull();
    getSpotifyHeaders.mockImplementationOnce(async () => {
      throw new Error("Spotify credentials not configured");
    });
    expect(await catalogBlock("s")).toBeNull();
  });
});
