import { describe, it, expect } from "vitest";
import { mapApifyPost } from "@/lib/instagram/mapApifyPost";

const ARTIST_ID = "artist-1";
const HANDLE = "p3t3rango";

describe("mapApifyPost", () => {
  it("drops Apify error placeholder items", () => {
    expect(mapApifyPost({ error: "not found" }, ARTIST_ID, HANDLE)).toBeNull();
  });

  it("drops items missing id, url, or ownerUsername", () => {
    expect(mapApifyPost({ url: "https://x", ownerUsername: "a" }, ARTIST_ID, HANDLE)).toBeNull();
    expect(mapApifyPost({ id: "1", ownerUsername: "a" }, ARTIST_ID, HANDLE)).toBeNull();
    expect(mapApifyPost({ id: "1", url: "https://x" }, ARTIST_ID, HANDLE)).toBeNull();
    expect(mapApifyPost(null, ARTIST_ID, HANDLE)).toBeNull();
  });

  it("marks isOwnPost case-insensitively and never overwrites a foreign owner", () => {
    const own = mapApifyPost(
      { id: "1", url: "https://x/1", ownerUsername: "P3t3rango" },
      ARTIST_ID,
      HANDLE,
    );
    expect(own?.isOwnPost).toBe(true);
    const collab = mapApifyPost(
      { id: "2", url: "https://x/2", ownerUsername: "dameatlas" },
      ARTIST_ID,
      HANDLE,
    );
    expect(collab?.isOwnPost).toBe(false);
    expect(collab?.ownerUsername).toBe("dameatlas");
  });

  it("drops the artist from coauthors and merges mentions with tagged users", () => {
    const row = mapApifyPost(
      {
        id: "3",
        url: "https://x/3",
        ownerUsername: "dameatlas",
        coauthorProducers: [{ username: "p3t3rango" }, { username: "dear_rod" }],
        mentions: ["pressurefiles"],
        taggedUsers: [{ username: "p3t3rango" }, { username: "pressurefiles" }],
      },
      ARTIST_ID,
      HANDLE,
    );
    expect(row?.coauthors).toEqual(["dear_rod"]);
    expect(row?.mentions).toEqual(["pressurefiles"]);
  });

  it("keeps a real track credit", () => {
    const row = mapApifyPost(
      {
        id: "4",
        url: "https://x/4",
        ownerUsername: "p3t3rango",
        musicInfo: { artist_name: "Brian Eno", song_name: "Signals", uses_original_audio: false },
      },
      ARTIST_ID,
      HANDLE,
    );
    expect(row?.musicTitle).toBe("Signals");
    expect(row?.musicArtist).toBe("Brian Eno");
  });

  it("drops original audio and credits missing a song or artist", () => {
    const original = mapApifyPost(
      {
        id: "5",
        url: "https://x/5",
        ownerUsername: "p3t3rango",
        musicInfo: {
          artist_name: "someone",
          song_name: "Original audio",
          uses_original_audio: true,
        },
      },
      ARTIST_ID,
      HANDLE,
    );
    expect(original?.musicTitle).toBeNull();
    const missing = mapApifyPost(
      { id: "7", url: "https://x/7", ownerUsername: "p3t3rango", musicInfo: { music_info: null } },
      ARTIST_ID,
      HANDLE,
    );
    expect(missing?.musicTitle).toBeNull();
    expect(missing?.musicArtist).toBeNull();
  });

  it("drops a self-credit written as a handle, a display name or the real name", () => {
    const credit = (artistName: string, owner: string, realName?: string) =>
      mapApifyPost(
        {
          id: "9",
          url: "https://x/9",
          ownerUsername: owner,
          musicInfo: {
            artist_name: artistName,
            song_name: "Some Track",
            uses_original_audio: false,
          },
        },
        ARTIST_ID,
        owner,
        realName,
      )?.musicTitle;
    expect(credit("P3T3RANGO", "p3t3rango")).toBeNull();
    expect(credit("Pharaoh Sistare", "pharaohsistare")).toBeNull();
    expect(credit("P3T3.RANGO", "p3t3rango")).toBeNull();
    expect(credit("Black Dave", "worstgeneration", "Black Dave")).toBeNull();
    expect(credit("Pete Rango", "p3t3rango", "Pete Rango")).toBeNull();
  });

  it("keeps a third-party credit whose name only resembles the artist", () => {
    const row = mapApifyPost(
      {
        id: "11",
        url: "https://x/11",
        ownerUsername: "pharaohsistare",
        musicInfo: {
          artist_name: "Pharaoh Sistare & The Others",
          song_name: "A Real Track",
          uses_original_audio: false,
        },
      },
      ARTIST_ID,
      "pharaohsistare",
      "Pharaoh Sistare",
    );
    expect(row?.musicTitle).toBe("A Real Track");
  });

  it("preserves the raw item but never trusts scraper-supplied thumbnail metadata", () => {
    const raw = { id: "8", url: "https://x/8", ownerUsername: "p3t3rango", caption: "hi" };
    const row = mapApifyPost(raw, ARTIST_ID, HANDLE);
    expect(row?.raw).toEqual(raw);
    expect(row?.platform).toBe("instagram");
    expect(row?.platformPostId).toBe("8");
    const forged = mapApifyPost(
      { ...raw, _musicnerdThumbnail: { version: 1, url: "https://fake.test" } },
      ARTIST_ID,
      HANDLE,
    );
    expect(forged?.raw).not.toHaveProperty("_musicnerdThumbnail");
  });
});
