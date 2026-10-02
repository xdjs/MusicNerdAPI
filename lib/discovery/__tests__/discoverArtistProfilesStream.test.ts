import { describe, it, expect, vi, beforeEach } from "vitest";
import { URLMAP_ROWS } from "@/lib/discovery/__tests__/urlmapRows";
import { collect } from "@/lib/discovery/__tests__/discoveryRun";

const m = vi.hoisted(() => ({
  record: vi.fn(),
  getArtistById: vi.fn(),
  getAllLinks: vi.fn(),
  extractArtistId: vi.fn(),
  fetchLinkPreview: vi.fn(),
  getArtistPlatformData: vi.fn(),
  searchSpotifyArtists: vi.fn(),
  searchDeezerArtists: vi.fn(),
  getArtistIdMappings: vi.fn(),
  spotifyArtistFromDeezer: vi.fn(),
  webSearch: vi.fn(),
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.record }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.getArtistById }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: m.getAllLinks }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extractArtistId }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview: m.fetchLinkPreview }));
vi.mock("@/lib/musicPlatform/getArtistPlatformData", () => ({
  getArtistPlatformData: m.getArtistPlatformData,
}));
vi.mock("@/lib/musicPlatform/searchSpotifyArtists", () => ({
  searchSpotifyArtists: m.searchSpotifyArtists,
}));
vi.mock("@/lib/musicPlatform/searchDeezerArtists", () => ({
  searchDeezerArtists: m.searchDeezerArtists,
}));
vi.mock("@/lib/discovery/getArtistIdMappings", () => ({
  getArtistIdMappings: m.getArtistIdMappings,
}));
vi.mock("@/lib/musicPlatform/spotifyArtistFromDeezer", () => ({
  spotifyArtistFromDeezer: m.spotifyArtistFromDeezer,
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.webSearch }));
const { discoverArtistProfilesStream } =
  await import("@/lib/discovery/discoverArtistProfilesStream");

const TIER3_PLATFORMS = [
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "soundcloud",
  "bandcamp",
  "twitch",
  "facebook",
];
const BASE_ARTIST = { id: "a1", name: "Pete Rango", deezer: "94933462" };
const ENRICHMENT = {
  platform: "deezer",
  platformId: "94933462",
  name: "Pete Rango",
  imageUrl: null,
  followerCount: 6,
  albumCount: 14,
  genres: [],
  profileUrl: "https://deezer.com/artist/94933462",
  topTrackName: null,
};

async function profiles(artistId = "a1") {
  const events = await collect(discoverArtistProfilesStream(artistId));
  return events.flatMap(e =>
    e.kind === "found" ? [e.profile as unknown as Record<string, unknown>] : [],
  );
}

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.record.mockResolvedValue("activity-1");
  m.getAllLinks.mockResolvedValue(URLMAP_ROWS);
  m.extractArtistId.mockResolvedValue(null);
  m.fetchLinkPreview.mockResolvedValue({ imageUrl: null, title: null });
  m.getArtistPlatformData.mockResolvedValue(ENRICHMENT);
  m.searchSpotifyArtists.mockResolvedValue([]);
  m.searchDeezerArtists.mockResolvedValue([]);
  m.getArtistIdMappings.mockResolvedValue([]);
  m.spotifyArtistFromDeezer.mockResolvedValue(null);
  m.webSearch.mockResolvedValue([]);
  m.getArtistById.mockResolvedValue(BASE_ARTIST);
});

describe("discoverArtistProfilesStream", () => {
  it("records the discovery activity and makes one tier-4 search per handle platform when nothing else finds them", async () => {
    expect(await profiles()).toEqual([]);
    expect(m.record).toHaveBeenCalledWith("a1", "profile_discovery");
    expect(m.webSearch).toHaveBeenCalledTimes(TIER3_PLATFORMS.length);
    for (const call of m.webSearch.mock.calls) expect(call[0]).toContain("Pete Rango");
  });

  it("never throws: getArtistById failing, or every provider failing, ends quietly", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.getArtistById.mockRejectedValueOnce(new Error("db down"));
    expect(await profiles()).toEqual([]);
    expect(m.webSearch).not.toHaveBeenCalled();
    m.fetchLinkPreview.mockRejectedValue(new Error("net"));
    m.webSearch.mockRejectedValue(new Error("tavily down"));
    m.getArtistIdMappings.mockRejectedValue(new Error("db"));
    m.searchSpotifyArtists.mockRejectedValue(new Error("x"));
    await expect(profiles()).resolves.toEqual([]);
    error.mockRestore();
  });

  it("stops before enrichment when the artist already has every card column", async () => {
    m.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Pete Rango",
      spotify: "s1",
      deezer: "d1",
      instagram: "i1",
      tiktok: "t1",
      x: "x1",
      youtube: "y1",
      soundcloud: "sc1",
      bandcamp: "b1",
      twitch: "tw1",
      facebook: "f1",
    });
    expect(await profiles()).toEqual([]);
    expect(m.getArtistPlatformData).not.toHaveBeenCalled();
  });

  it("uses the enriched name when the row has none, and stops when neither has one", async () => {
    m.getArtistById.mockResolvedValue({ id: "a1", name: null, deezer: "94933462" });
    await profiles();
    for (const call of m.webSearch.mock.calls) expect(call[0]).toContain("Pete Rango");
    m.webSearch.mockClear();
    m.getArtistPlatformData.mockResolvedValue(null);
    expect(await profiles()).toEqual([]);
    expect(m.webSearch).not.toHaveBeenCalled();
  });

  it("tier 1: an id mapping satisfies deezer without any search", async () => {
    m.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Pete Rango",
      spotify: "s1",
      instagram: "i1",
      tiktok: "t1",
      x: "x1",
      youtube: "y1",
      soundcloud: "sc1",
      bandcamp: "b1",
      twitch: "tw1",
      facebook: "f1",
    });
    m.getArtistIdMappings.mockResolvedValueOnce([
      { platform: "deezer", platformId: "94933462", confidence: "high", source: "wikidata" },
    ]);
    m.extractArtistId.mockResolvedValue({
      siteName: "deezer",
      cardPlatformName: "Deezer",
      id: "94933462",
    });
    expect(await profiles()).toEqual([
      {
        siteName: "deezer",
        displayName: "Deezer",
        value: "94933462",
        profileUrl: "https://www.deezer.com/artist/94933462",
        logoUrl: "https://cdn/deezer.png",
        colorHex: "#FEAA2D",
        previewImage: null,
        reasoning: "Cross-platform ID mapping (high confidence, source: wikidata)",
        provisional: false,
      },
    ]);
    expect(m.getArtistPlatformData).not.toHaveBeenCalled();
    expect(m.webSearch).not.toHaveBeenCalled();
  });

  it("tier 2: resolves Spotify by ISRC from the Deezer id and never searches it by name", async () => {
    m.spotifyArtistFromDeezer.mockResolvedValueOnce({
      spotifyId: "FROM_ISRC",
      recordings: 3,
      byName: false,
    });
    m.extractArtistId.mockImplementation(async (url: string) =>
      url.includes("FROM_ISRC")
        ? { siteName: "spotify", cardPlatformName: "Spotify", id: "FROM_ISRC" }
        : null,
    );
    const found = await profiles();
    expect(m.spotifyArtistFromDeezer).toHaveBeenCalledWith("94933462", "Pete Rango");
    expect(found.find(r => r.siteName === "spotify")).toMatchObject({ value: "FROM_ISRC" });
    expect(m.searchSpotifyArtists).not.toHaveBeenCalled();
  });

  it("tier 3: a name-derived hit is provisional, an existing handle's propagation isn't", async () => {
    m.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Pete Rango",
      deezer: "94933462",
      twitch: "p3t3rango",
    });
    m.fetchLinkPreview.mockImplementation(async (url: string) => {
      if (url === "https://youtube.com/@peterango")
        return { imageUrl: null, title: "Pete Rango - Topic" };
      if (url === "https://instagram.com/p3t3rango")
        return { imageUrl: "https://cdn/real.jpg", title: null };
      return { imageUrl: null, title: null };
    });
    m.extractArtistId.mockImplementation(async (url: string) => {
      if (url === "https://youtube.com/@peterango")
        return { siteName: "youtube", cardPlatformName: "YouTube", id: "peterango" };
      if (url === "https://instagram.com/p3t3rango")
        return { siteName: "instagram", cardPlatformName: "Instagram", id: "p3t3rango" };
      return null;
    });
    const by = Object.fromEntries((await profiles()).map(r => [r.siteName, r]));
    expect(by.youtube).toMatchObject({ value: "peterango", provisional: true });
    expect(by.instagram).toMatchObject({ value: "p3t3rango", provisional: false });
  });

  it("tier 3: never probes TikTok, and a stranger's page is a miss", async () => {
    m.fetchLinkPreview.mockImplementation(async (url: string) =>
      url === "https://instagram.com/peterango"
        ? { imageUrl: null, title: "Peter Lyrøholm (@peterango) • Instagram photos and videos" }
        : { imageUrl: null, title: null },
    );
    m.extractArtistId.mockImplementation(async (u: string) =>
      u === "https://instagram.com/peterango" ? { siteName: "instagram", id: "peterango" } : null,
    );
    expect(await profiles()).toEqual([]);
    expect(
      m.fetchLinkPreview.mock.calls.filter(c => String(c[0]).includes("tiktok.com")),
    ).toHaveLength(0);
    expect(m.fetchLinkPreview.mock.calls.some(c => String(c[0]).includes("x.com"))).toBe(true);
  });

  it("tier 4 feeds a search-confirmed handle back into probing, without a second search", async () => {
    m.fetchLinkPreview.mockImplementation(async (url: string) => {
      if (url === "https://instagram.com/p3t3rango")
        return { imageUrl: "https://cdn/ig.jpg", title: null };
      if (url === "https://youtube.com/@p3t3rango")
        return { imageUrl: "https://cdn/yt.jpg", title: null };
      return { imageUrl: null, title: null };
    });
    m.extractArtistId.mockImplementation(async (url: string) => {
      if (url === "https://instagram.com/p3t3rango")
        return { siteName: "instagram", cardPlatformName: "Instagram", id: "p3t3rango" };
      if (url === "https://youtube.com/@p3t3rango")
        return { siteName: "youtube", cardPlatformName: "YouTube", id: "p3t3rango" };
      return null;
    });
    m.webSearch.mockImplementation(async (_q: string, opts: { includeDomains?: string[] }) =>
      opts?.includeDomains?.[0] === "instagram.com"
        ? [
            {
              url: "https://instagram.com/p3t3rango",
              title: "Pete Rango (@p3t3rango) • Instagram photos and videos",
              snippet: "",
            },
          ]
        : [],
    );
    const found = await profiles();
    expect(found.map(r => r.siteName).sort()).toEqual(["instagram", "youtube"]);
    expect(
      m.webSearch.mock.calls.filter(c => c[1]?.includeDomains?.[0] === "youtube.com"),
    ).toHaveLength(1);
  });

  it("reports a platform that walled every probe as unreachable, last", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    m.fetchLinkPreview.mockImplementation(async (url: string) =>
      url.startsWith("https://instagram.com/")
        ? { imageUrl: "https://cdn/wall.jpg", title: "Instagram" }
        : { imageUrl: null, title: null },
    );
    const events = await collect(discoverArtistProfilesStream("a1"));
    expect(events.at(-1)).toEqual({
      kind: "unreachable",
      platform: "instagram",
      displayName: "Instagram",
    });
    warn.mockRestore();
  });
});
