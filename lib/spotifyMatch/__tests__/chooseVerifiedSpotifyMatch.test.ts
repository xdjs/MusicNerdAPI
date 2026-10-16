import { describe, expect, it } from "vitest";
import { chooseVerifiedSpotifyMatch } from "../chooseVerifiedSpotifyMatch";

const artist = { id: "AAAAAAAAAAAAAAAAAAAAAA", name: "The Ellis Court" };
const guest = { id: "BBBBBBBBBBBBBBBBBBBBBB", name: "Other Band" };
describe("automatic Spotify identity evidence", () => {
  it("requires a matching artist name and agreement across distinct recordings", () => {
    expect(
      chooseVerifiedSpotifyMatch("THE ELLIS COURT", [
        { isrc: "A", artists: [artist, guest] },
        { isrc: "B", artists: [artist] },
      ]),
    ).toEqual({ status: "verified", spotifyId: artist.id, recordings: 2 });
    expect(
      chooseVerifiedSpotifyMatch("Another Band", [
        { isrc: "A", artists: [artist] },
        { isrc: "B", artists: [artist] },
      ]).status,
    ).toBe("ambiguous");
  });
  it("never treats duplicate rows or a single recording as corroboration", () => {
    expect(
      chooseVerifiedSpotifyMatch(artist.name, [
        { isrc: "A", artists: [artist, artist] },
        { isrc: "A", artists: [artist] },
      ]).status,
    ).toBe("ambiguous");
  });
  it("leaves competing identities for review instead of selecting the first artist", () => {
    expect(
      chooseVerifiedSpotifyMatch(artist.name, [
        { isrc: "A", artists: [guest, artist] },
        { isrc: "B", artists: [guest, artist] },
      ]).status,
    ).toBe("ambiguous");
    expect(chooseVerifiedSpotifyMatch(artist.name, []).status).toBe("not_found");
  });
});

it("does not auto-attach otherwise sufficient but truncated recording evidence", () => {
  const artists = [{ id: "AAAAAAAAAAAAAAAAAAAAAA", name: "The Ellis Court" }];
  expect(
    chooseVerifiedSpotifyMatch("The Ellis Court", [
      { isrc: "USAAA2600001", artists, incomplete: true },
      { isrc: "USAAA2600002", artists },
    ]),
  ).toEqual({ status: "ambiguous" });
});
