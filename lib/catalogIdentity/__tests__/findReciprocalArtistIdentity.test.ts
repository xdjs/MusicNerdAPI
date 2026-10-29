import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ wikidata: vi.fn(), mb: vi.fn(), identity: vi.fn() }));
vi.mock("@/lib/catalogIdentity/findWikidataCounterpart", () => ({
  findWikidataCounterpart: m.wikidata,
}));
vi.mock("@/lib/musicbrainz/findMusicBrainzCounterpart", () => ({
  findMusicBrainzCounterpart: m.mb,
}));
vi.mock("@/lib/catalogIdentity/getArtistIdentity", () => ({ getArtistIdentity: m.identity }));
const { findReciprocalArtistIdentity } =
  await import("@/lib/catalogIdentity/findReciprocalArtistIdentity");

const artist = {
  platform: "spotify" as const,
  platformId: "4Z8W4fKeB5YxbusRsdQVPb",
  name: "Radiohead",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.identity.mockResolvedValue({ platform: "deezer", platformId: "399", name: "Radiohead" });
});

describe("findReciprocalArtistIdentity", () => {
  it("takes Wikidata's match once the platform confirms the id and name", async () => {
    m.wikidata.mockResolvedValue({ status: "match", platformId: "399", wikidataId: "Q44190" });
    expect(await findReciprocalArtistIdentity(artist)).toEqual({
      platform: "deezer",
      platformId: "399",
      source: "wikidata",
      wikidataId: "Q44190",
    });
    expect(m.identity).toHaveBeenCalledWith("deezer", "399");
    expect(m.mb).not.toHaveBeenCalled();
  });

  it("falls back to MusicBrainz on a Wikidata miss", async () => {
    m.wikidata.mockResolvedValue({ status: "miss" });
    m.mb.mockResolvedValue({ platformId: "399", musicbrainzId: "mb1" });
    expect(await findReciprocalArtistIdentity(artist)).toEqual({
      platform: "deezer",
      platformId: "399",
      source: "musicbrainz",
      musicbrainzId: "mb1",
    });
  });

  it("abstains when Wikidata is ambiguous or down, or the platform disagrees", async () => {
    m.wikidata.mockResolvedValueOnce({ status: "ambiguous" });
    expect(await findReciprocalArtistIdentity(artist)).toBeNull();
    m.wikidata.mockRejectedValueOnce(new Error("down"));
    expect(await findReciprocalArtistIdentity(artist)).toBeNull();
    expect(m.mb).not.toHaveBeenCalled();

    m.wikidata.mockResolvedValue({ status: "match", platformId: "399", wikidataId: "Q1" });
    m.identity.mockResolvedValueOnce({ platform: "deezer", platformId: "400", name: "Radiohead" });
    expect(await findReciprocalArtistIdentity(artist)).toBeNull();
    m.identity.mockResolvedValueOnce({
      platform: "deezer",
      platformId: "399",
      name: "Someone Else",
    });
    expect(await findReciprocalArtistIdentity(artist)).toBeNull();
  });
});
