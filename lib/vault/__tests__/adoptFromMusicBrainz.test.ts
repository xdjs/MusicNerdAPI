import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  fetchMusicBrainzLinks: vi.fn(),
  extractArtistId: vi.fn(),
  belongs: vi.fn(async (_artistId: string, _site: string, _handle: string) => false),
  contradicts: vi.fn(async (_artistId: string, _site: string, _handle: string) => false),
  ambiguous: vi.fn(async (_artistId: string, _name: string) => false),
  pageNamesArtist: vi.fn(async (_url: string, _name: string) => true),
  writeArtistLink: vi.fn(
    async (
      _a: string,
      _site: string,
      _value: string,
      _provisional?: Set<string>,
      _record?: Record<string, unknown>,
    ) => {},
  ),
}));
vi.mock("@/lib/musicbrainz/fetchMusicBrainzLinks", () => ({
  fetchMusicBrainzLinks: m.fetchMusicBrainzLinks,
}));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extractArtistId }));
vi.mock("@/lib/sources/stripQuery", () => ({ stripQuery: (u: string) => u }));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: m.belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: m.contradicts,
}));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: m.ambiguous,
}));
vi.mock("@/lib/vault/pageNamesArtist", () => ({ pageNamesArtist: m.pageNamesArtist }));
vi.mock("@/lib/vault/writeArtistLink", () => ({ writeArtistLink: m.writeArtistLink }));
const { adoptFromMusicBrainz } = await import("@/lib/vault/adoptFromMusicBrainz");

const byUrl: Record<string, { siteName: string; id: string }> = {
  "https://twitter.com/p3t3rango": { siteName: "x", id: "p3t3rango" },
  "https://instagram.com/p3t3rango": { siteName: "instagram", id: "p3t3rango" },
  "https://instagram.com/p": { siteName: "instagram", id: "p" },
  "https://en.wikipedia.org/wiki/Pete": { siteName: "wikipedia", id: "Pete" },
  "https://www.discogs.com/artist/1967268": { siteName: "discogs", id: "1967268" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  m.extractArtistId.mockImplementation(async (u: string) =>
    byUrl[u] ? { ...byUrl[u], cardPlatformName: null } : null,
  );
});

describe("adoptFromMusicBrainz", () => {
  it("adopts account and reference links from an identifier match without a page check", async () => {
    m.fetchMusicBrainzLinks.mockResolvedValueOnce({
      matchedBy: "identifier",
      urls: Object.keys(byUrl),
      homepage: "https://peterango.com",
    });
    const artist: Record<string, unknown> = { spotify: "S1", deezer: null };
    const result = await adoptFromMusicBrainz("a1", "Pete Rango", artist);
    expect(m.fetchMusicBrainzLinks).toHaveBeenCalledWith("Pete Rango", {
      spotify: "S1",
      deezer: null,
    });
    expect(m.writeArtistLink.mock.calls.map(c => [c[1], c[2]])).toEqual([
      ["x", "p3t3rango"],
      ["instagram", "p3t3rango"],
      ["discogs", "1967268"],
    ]);
    expect(m.pageNamesArtist).not.toHaveBeenCalled();
    expect(result).toEqual({
      handles: new Set(["p3t3rango", "1967268"]),
      homepage: "https://peterango.com",
      authoritative: true,
    });
  });

  it("skips held columns, other artists' handles and ones their posts contradict", async () => {
    m.fetchMusicBrainzLinks.mockResolvedValueOnce({
      matchedBy: "identifier",
      urls: [
        "https://twitter.com/p3t3rango",
        "https://instagram.com/p3t3rango",
        "https://www.discogs.com/artist/1967268",
      ],
      homepage: null,
    });
    m.belongs.mockImplementation(async (_a: string, site: string) => site === "discogs");
    m.contradicts.mockImplementation(async (_a: string, site: string) => site === "instagram");
    await adoptFromMusicBrainz("a1", "Pete Rango", { x: "held" });
    expect(m.writeArtistLink).not.toHaveBeenCalled();
    m.belongs.mockImplementation(async () => false);
    m.contradicts.mockImplementation(async () => false);
  });

  it("re-answers a provisional column", async () => {
    m.fetchMusicBrainzLinks.mockResolvedValueOnce({
      matchedBy: "identifier",
      urls: ["https://twitter.com/p3t3rango"],
      homepage: null,
    });
    const provisional = new Set(["x"]);
    const artist = { x: "guess" };
    await adoptFromMusicBrainz("a1", "Pete Rango", artist, provisional);
    expect(m.writeArtistLink).toHaveBeenCalledWith("a1", "x", "p3t3rango", provisional, artist);
  });

  it("checks each page of an exact-name match, and stops for a shared name", async () => {
    m.fetchMusicBrainzLinks.mockResolvedValueOnce({
      matchedBy: "exact-name",
      urls: ["https://twitter.com/p3t3rango", "https://instagram.com/p3t3rango"],
      homepage: null,
    });
    m.pageNamesArtist.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const result = await adoptFromMusicBrainz("a1", "Pete Rango", {});
    expect(m.writeArtistLink.mock.calls.map(c => c[1])).toEqual(["instagram"]);
    expect(result.authoritative).toBe(false);

    m.writeArtistLink.mockClear();
    m.ambiguous.mockResolvedValueOnce(true);
    m.fetchMusicBrainzLinks.mockResolvedValueOnce({
      matchedBy: "exact-name",
      urls: ["https://twitter.com/p3t3rango"],
      homepage: "h",
    });
    expect(await adoptFromMusicBrainz("a1", "Black Dave", {})).toEqual({
      handles: new Set(),
      homepage: "h",
      authoritative: false,
    });
    expect(m.writeArtistLink).not.toHaveBeenCalled();
  });

  it("keeps going when one write fails, and never throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.fetchMusicBrainzLinks.mockResolvedValueOnce({
      matchedBy: "identifier",
      urls: ["https://twitter.com/p3t3rango", "https://instagram.com/p3t3rango"],
      homepage: null,
    });
    m.writeArtistLink.mockImplementationOnce(async () => {
      throw new Error("conflict");
    });
    expect((await adoptFromMusicBrainz("a1", "Pete Rango", {})).handles).toEqual(
      new Set(["p3t3rango"]),
    );
    m.fetchMusicBrainzLinks.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    expect(await adoptFromMusicBrainz("a1", "Pete Rango", {})).toEqual({
      handles: new Set(),
      homepage: null,
      authoritative: false,
    });
  });

  it("returns nothing when MusicBrainz doesn't know the artist", async () => {
    m.fetchMusicBrainzLinks.mockResolvedValueOnce(null);
    expect(await adoptFromMusicBrainz("a1", "Pete Rango", {})).toEqual({
      handles: new Set(),
      homepage: null,
      authoritative: false,
    });
  });
});

it("never adopts a release URL as an artist ID through a loose legacy mapping", async () => {
  m.fetchMusicBrainzLinks.mockResolvedValueOnce({
    matchedBy: "identifier",
    urls: ["https://open.spotify.com/album/3DmaZbBPnKSGnxYRpHobss"],
    homepage: null,
  });
  m.extractArtistId.mockResolvedValue({ siteName: "spotify", id: "3DmaZbBPnKSGnxYRpHobss" });
  const result = await adoptFromMusicBrainz("a1", "Grimes", {});
  expect(result.handles.size).toBe(0);
  expect(m.writeArtistLink).not.toHaveBeenCalled();
});

it("retains the Bandcamp artist handle from a curated artist-scoped album link", async () => {
  m.fetchMusicBrainzLinks.mockResolvedValueOnce({
    matchedBy: "identifier",
    urls: ["https://grimes.bandcamp.com/album/new-release"],
    homepage: null,
  });
  const artist = {};
  expect((await adoptFromMusicBrainz("a1", "Grimes", artist)).handles).toEqual(new Set(["grimes"]));
  expect(m.writeArtistLink).toHaveBeenCalledWith("a1", "bandcamp", "grimes", undefined, artist);
  expect(m.extractArtistId).not.toHaveBeenCalled();
});
