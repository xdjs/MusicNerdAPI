import { describe, it, expect, vi, beforeEach } from "vitest";
import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";

const { getArtistIdMappings } = vi.hoisted(() => ({ getArtistIdMappings: vi.fn() }));
vi.mock("@/lib/discovery/getArtistIdMappings", () => ({ getArtistIdMappings }));
const { tierOneIdMappings } = await import("@/lib/discovery/tierOneIdMappings");

beforeEach(() => {
  getArtistIdMappings.mockReset();
});

describe("tierOneIdMappings", () => {
  it("turns a missing column's mapping into a candidate, skipping low confidence", async () => {
    getArtistIdMappings.mockResolvedValueOnce([
      { platform: "deezer", platformId: "94933462", confidence: "high", source: "wikidata" },
      { platform: "apple_music", platformId: "1", confidence: "high", source: "x" },
    ]);
    expect(await tierOneIdMappings("a1", new Set(["deezer"]), URLMAP_BY_SITE)).toEqual([
      {
        tier: 1,
        platform: "deezer",
        url: "https://www.deezer.com/artist/94933462",
        reasoning: "Cross-platform ID mapping (high confidence, source: wikidata)",
      },
    ]);
    getArtistIdMappings.mockResolvedValueOnce([
      { platform: "deezer", platformId: "1", confidence: "low", source: "name_search" },
    ]);
    expect(await tierOneIdMappings("a1", new Set(["deezer"]), URLMAP_BY_SITE)).toEqual([]);
  });

  it("does nothing with nothing missing, and never throws", async () => {
    expect(await tierOneIdMappings("a1", new Set(), URLMAP_BY_SITE)).toEqual([]);
    expect(getArtistIdMappings).not.toHaveBeenCalled();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getArtistIdMappings.mockRejectedValueOnce(new Error("db"));
    expect(await tierOneIdMappings("a1", new Set(["deezer"]), URLMAP_BY_SITE)).toEqual([]);
    error.mockRestore();
  });
});
