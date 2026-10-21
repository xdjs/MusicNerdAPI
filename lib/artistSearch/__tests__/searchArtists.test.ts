import { beforeEach, describe, expect, it, vi } from "vitest";

const { local, external, images } = vi.hoisted(() => ({
  local: vi.fn(),
  external: vi.fn(),
  images: vi.fn(),
}));
vi.mock("@/lib/artistSearch/searchForArtistByName", () => ({ searchForArtistByName: local }));
vi.mock("@/lib/musicPlatform/searchDeezerArtists", () => ({ searchDeezerArtists: external }));
vi.mock("@/lib/musicPlatform/getArtistImages", () => ({ getArtistImages: images }));
const { searchArtists } = await import("@/lib/artistSearch/searchArtists");

const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  spotify: null,
  deezer: null,
  bandcamp: null,
  youtube: null,
  youtubechannel: null,
  instagram: null,
  x: null,
  facebook: null,
  tiktok: null,
  customImage: null,
  match_type: 0,
  ...extra,
});
const ext = (platformId: string, name: string) => ({
  platform: "deezer",
  platformId,
  name,
  imageUrl: `img-${platformId}`,
  followerCount: 1,
  albumCount: 1,
  genres: [],
  profileUrl: `https://www.deezer.com/artist/${platformId}`,
  topTrackName: null,
});

beforeEach(() => {
  local.mockReset();
  external.mockReset();
  images.mockReset().mockResolvedValue(new Map());
});

describe("searchArtists", () => {
  it("merges local and Deezer results with MusicNerdWeb's fields, dropping Deezer artists already here", async () => {
    local.mockResolvedValueOnce([
      row("a1", "Pete Rango", { deezer: "11", bio: "private", x: "pr", instagram: "pr" }),
    ]);
    external.mockResolvedValueOnce([ext("11", "Pete Rango"), ext("12", "Pete Rango II")]);
    images.mockResolvedValueOnce(new Map([["a1", "img-a1"]]));
    const results = await searchArtists("pete rango", []);
    expect(results).toEqual([
      {
        ...row("a1", "Pete Rango", { deezer: "11", x: "pr", instagram: "pr" }),
        bio: null,
        isExternalOnly: false,
        imageUrl: "img-a1",
        matchScore: 0,
        linkCount: 2,
      },
      {
        id: null,
        name: "Pete Rango II",
        platformId: "12",
        platform: "deezer",
        imageUrl: "img-12",
        profileUrl: "https://www.deezer.com/artist/12",
        isExternalOnly: true,
        matchScore: 1,
        linkCount: 0,
      },
    ]);
    expect(external).toHaveBeenCalledWith("pete rango", 10);
  });

  it("only asks the providers for images of artists without their own upload", async () => {
    const own = row("a1", "Own", { customImage: " https://cdn/own.png " });
    const none = row("a2", "None");
    local.mockResolvedValueOnce([own, none]);
    external.mockResolvedValueOnce([]);
    const results = await searchArtists("x", []);
    expect(images).toHaveBeenCalledWith([none]);
    // Both are tier 3 for "x" with no links, so they sort by name: None, Own.
    expect(results.map(r => r.imageUrl)).toEqual([null, "https://cdn/own.png"]);
  });

  it("sorts by match tier, then bookmarks, then link count, then name", async () => {
    local.mockResolvedValueOnce([
      row("z", "Z Rango", { x: "1", instagram: "2" }),
      row("b", "B Rango"),
      row("m", "M Rango", { x: "1" }),
      row("e", "Rango"),
    ]);
    external.mockResolvedValueOnce([ext("9", "Rango Deezer")]);
    const results = await searchArtists("Rango", ["b"]);
    // Exact, then the prefix match (Deezer), then the substring tier: the
    // bookmarked artist first, then more links, then name.
    expect(results.map(r => r.name)).toEqual([
      "Rango",
      "Rango Deezer",
      "B Rango",
      "Z Rango",
      "M Rango",
    ]);
  });

  it("survives a Deezer or image failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    local.mockResolvedValueOnce([row("a1", "Pete")]);
    external.mockRejectedValueOnce(new Error("down"));
    images.mockRejectedValueOnce(new Error("down"));
    expect((await searchArtists("Pete", [])).map(r => r.id)).toEqual(["a1"]);
    error.mockRestore();
  });
});
