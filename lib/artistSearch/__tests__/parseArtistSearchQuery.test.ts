import { describe, expect, it } from "vitest";
import { parseArtistSearchQuery } from "@/lib/artistSearch/parseArtistSearchQuery";
const id = "7DRT8Nq9pZ9HuwZTSS7L8v";
describe("parseArtistSearchQuery", () => {
  it.each([id, ` ${id} `])("retains name search for bare Spotify %s", query => {
    expect(parseArtistSearchQuery(query)).toEqual({
      platform: "spotify",
      platformId: id,
      includeNameResults: true,
    });
  });
  it.each(["1975", "85860872"])("retains numeric name %s", platformId => {
    expect(parseArtistSearchQuery(platformId)).toEqual({
      platform: "deezer",
      platformId,
      includeNameResults: true,
    });
  });
  it.each([
    `spotify:artist:${id}`,
    `https://open.spotify.com/artist/${id}`,
    `https://open.spotify.com/intl-es/artist/${id}/?si=share#ok`,
  ])("parses explicit Spotify %s", query => {
    expect(parseArtistSearchQuery(query)).toEqual({
      platform: "spotify",
      platformId: id,
      includeNameResults: false,
    });
  });
  it.each([
    "https://deezer.com/artist/85860872",
    "https://www.deezer.com/en/artist/85860872/?utm_source=share",
  ])("parses explicit Deezer %s", query => {
    expect(parseArtistSearchQuery(query)).toEqual({
      platform: "deezer",
      platformId: "85860872",
      includeNameResults: false,
    });
  });
  it.each(["Pete Rango", "1975 band", "re:plus", "alt:V", "X: The Band", "0", "001975"])(
    "preserves ordinary names %s",
    query => expect(parseArtistSearchQuery(query)).toBeNull(),
  );
  it.each([
    `spotify:track:${id}`,
    `https://open.spotify.com/track/${id}`,
    `https://open.spotify.com/album/${id}`,
    `http://open.spotify.com/artist/${id}`,
    `https://open.spotify.com:443/artist/${id}`,
    `https://u@open.spotify.com/artist/${id}`,
    `https://open.spotify.com/track/../artist/${id}`,
    `https://open.spotify.com/artist%2F${id}`,
    `https://evil.test/artist/${id}`,
    `https://spotify.link/${id}`,
    `//open.spotify.com/artist/${id}`,
    `open.spotify.com/artist/${id}`,
    `https://www.deezer.com/artist/0`,
    `https://www.deezer.com/album/123`,
    "javascript:alert(1)",
    "mailto:someone@example.test",
    `https://open.spotify.com\\artist\\${id}`,
  ])("rejects unsupported input %s", query =>
    expect(() => parseArtistSearchQuery(query)).toThrow("artist link or ID"),
  );
});
