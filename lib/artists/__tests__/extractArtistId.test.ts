import { describe, it, expect, vi } from "vitest";
import { urlmapRows } from "@/lib/artists/__tests__/urlmapRows";

vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: async () => urlmapRows }));
const { extractArtistId } = await import("@/lib/artists/extractArtistId");

describe("extractArtistId", () => {
  it("resolves X, dropping query parameters", async () => {
    expect(await extractArtistId("https://x.com/sugar_plant?si=21")).toMatchObject({
      siteName: "x",
      id: "sugar_plant",
    });
  });

  it("rewrites legacy twitter.com hosts, with or without a scheme", async () => {
    expect(await extractArtistId("https://twitter.com/p3t3rango")).toMatchObject({
      siteName: "x",
      id: "p3t3rango",
    });
    expect(await extractArtistId("https://mobile.twitter.com/p3t3rango")).toMatchObject({
      siteName: "x",
      id: "p3t3rango",
    });
  });

  it("does not read any host containing 'x.' as X", async () => {
    expect(await extractArtistId("https://max.com/movie")).toBeNull();
    expect(await extractArtistId("https://linux.org/thread")).toBeNull();
  });

  it("accepts English Wikipedia only, percent-decoded", async () => {
    expect(await extractArtistId("https://en.wikipedia.org/wiki/Yun%C3%A8_Pinku")).toMatchObject({
      siteName: "wikipedia",
      id: "Yunè_Pinku",
    });
    expect(await extractArtistId("https://fr.wikipedia.org/wiki/Hardwell")).toBeNull();
  });

  it("reads Facebook usernames, people ids and profile.php ids", async () => {
    expect(
      await extractArtistId("https://www.facebook.com/tylerthecreator?ref=page"),
    ).toMatchObject({ siteName: "facebook", id: "tylerthecreator", cardPlatformName: "Facebook" });
    expect(
      await extractArtistId("https://www.facebook.com/people/Angela-Bofill/100044180243805/"),
    ).toMatchObject({ siteName: "facebookID", id: "100044180243805" });
    expect(
      await extractArtistId("https://m.facebook.com/profile.php?id=100044180243805"),
    ).toMatchObject({ siteName: "facebookID", id: "100044180243805" });
    expect(await extractArtistId("https://www.facebook.com/profile.php")).toBeNull();
    expect(await extractArtistId("https://www.notfacebook.com/username")).toBeNull();
  });

  it("accepts only 22-character Spotify artist ids, never a track or the literal type", async () => {
    expect(
      await extractArtistId("https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg"),
    ).toMatchObject({ siteName: "spotify", id: "0TnOYISbd1XYRBk9myaseg" });
    expect(
      await extractArtistId("https://open.spotify.com/track/0TnOYISbd1XYRBk9myaseg"),
    ).toBeNull();
    expect(await extractArtistId("https://open.spotify.com/artist/short")).toBeNull();
  });

  it("takes SoundCloud's username group, not the optional www", async () => {
    expect(await extractArtistId("https://www.soundcloud.com/peterango")).toMatchObject({
      siteName: "soundcloud",
      id: "peterango",
    });
    expect(await extractArtistId("https://soundcloud.com/peterango/sets/x")).toMatchObject({
      siteName: "soundcloud",
      id: "peterango",
    });
    expect(await extractArtistId("https://soundcloud.com/123456")).toBeNull();
  });

  it("rejects SoundCloud user-id links and falls back to the first path segment otherwise", async () => {
    expect(await extractArtistId("soundcloud.com/user-12345")).toBeNull();
    expect(await extractArtistId("soundcloud.com/peterango")).toMatchObject({
      siteName: "soundcloud",
      id: "peterango",
      cardPlatformName: "Soundcloud",
    });
  });

  it("reads YouTube handles and channel ids", async () => {
    expect(await extractArtistId("https://www.youtube.com/@PeteRango")).toMatchObject({
      siteName: "youtube",
      id: "PeteRango",
    });
    expect(await extractArtistId("https://youtube.com/robberthardwell")).toMatchObject({
      siteName: "youtube",
      id: "robberthardwell",
    });
    expect(await extractArtistId("https://www.youtube.com/channel/UC123abc")).toMatchObject({
      siteName: "youtubechannel",
      id: "UC123abc",
    });
  });

  it("uses the first capture group for everything else", async () => {
    expect(await extractArtistId("https://dupes.bandcamp.com/album/x")).toMatchObject({
      siteName: "bandcamp",
      id: "dupes",
    });
    expect(
      await extractArtistId("https://www.discogs.com/artist/1967268-Pete-Rango"),
    ).toMatchObject({ siteName: "discogs", id: "1967268" });
    expect(await extractArtistId("https://www.instagram.com/p3t3rango/")).toMatchObject({
      siteName: "instagram",
      id: "p3t3rango",
    });
  });

  it("is null for an unknown platform", async () => {
    expect(await extractArtistId("https://peterango.com/about")).toBeNull();
  });
});
