import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ request: vi.fn(), pace: vi.fn(async () => true) }));
vi.mock("@/lib/musicbrainz/requestMusicBrainz", () => ({ requestMusicBrainz: m.request }));
vi.mock("@/lib/musicbrainz/sinceLastCall", () => ({ sinceLastCall: m.pace }));
const { findMusicBrainzCounterpart } = await import("@/lib/musicbrainz/findMusicBrainzCounterpart");

const mbid = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
const spotifyId = "4Z8W4fKeB5YxbusRsdQVPb";
const spotifyUrl = `https://open.spotify.com/artist/${spotifyId}`;
const deezerUrl = "https://www.deezer.com/artist/399";
const owners = (id = mbid) => ({
  status: "ok",
  data: { relations: [{ "target-type": "artist", artist: { id } }] },
});
const detail = (urls: string[]) => ({
  status: "ok",
  data: {
    id: mbid,
    relations: urls.map(resource => ({ "target-type": "url", url: { resource } })),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  m.pace.mockResolvedValue(true);
});

describe("findMusicBrainzCounterpart", () => {
  it("returns the other platform's id when one artist owns both URLs", async () => {
    m.request
      .mockResolvedValueOnce(owners())
      .mockResolvedValueOnce(detail([spotifyUrl, deezerUrl]))
      .mockResolvedValueOnce(owners());
    expect(await findMusicBrainzCounterpart("spotify", spotifyId, "deezer")).toEqual({
      platformId: "399",
      musicbrainzId: mbid,
    });
    expect(m.request.mock.calls[0][0]).toContain(`resource=${encodeURIComponent(spotifyUrl)}`);
  });

  it("returns null when the source URL is unknown, shared, or the target is someone else's", async () => {
    m.request.mockResolvedValueOnce({ status: "not-found" });
    expect(await findMusicBrainzCounterpart("spotify", spotifyId, "deezer")).toBeNull();

    m.request.mockResolvedValueOnce({
      status: "ok",
      data: {
        relations: [
          { "target-type": "artist", artist: { id: mbid } },
          { "target-type": "artist", artist: { id: "b74b1b7f-71a5-4011-9441-d0b5e4122711" } },
        ],
      },
    });
    expect(await findMusicBrainzCounterpart("spotify", spotifyId, "deezer")).toBeNull();

    m.request
      .mockResolvedValueOnce(owners())
      .mockResolvedValueOnce(detail([spotifyUrl, deezerUrl]))
      .mockResolvedValueOnce(owners("b74b1b7f-71a5-4011-9441-d0b5e4122711"));
    expect(await findMusicBrainzCounterpart("spotify", spotifyId, "deezer")).toBeNull();
  });

  it("returns null when the entry has no unique target or the pacing budget runs out", async () => {
    m.request.mockResolvedValueOnce(owners()).mockResolvedValueOnce(detail([spotifyUrl]));
    expect(await findMusicBrainzCounterpart("spotify", spotifyId, "deezer")).toBeNull();
    m.pace.mockResolvedValueOnce(false);
    expect(await findMusicBrainzCounterpart("spotify", spotifyId, "deezer")).toBeNull();
  });

  it("never looks up a malformed id or the same platform", async () => {
    expect(await findMusicBrainzCounterpart("spotify", "short", "deezer")).toBeNull();
    expect(await findMusicBrainzCounterpart("deezer", "399", "deezer")).toBeNull();
    expect(m.request).not.toHaveBeenCalled();
  });
});
