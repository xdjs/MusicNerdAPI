import { describe, it, expect } from "vitest";
import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";

describe("titleMatchesArtist", () => {
  it("matches a platform title that contains the artist's name", () => {
    expect(
      titleMatchesArtist("Pete Rango (@p3t3rango) • Instagram photos and videos", "Pete Rango"),
    ).toBe(true);
  });

  it("matches in either direction, folded", () => {
    expect(titleMatchesArtist("rush, by PETE RANGO", "Pete Rango")).toBe(true);
    expect(titleMatchesArtist("Hardwell", "HARDWELL Official")).toBe(true);
  });

  it("rejects a different person and empty input", () => {
    expect(titleMatchesArtist("Twitch", "Pharaoh Sistare")).toBe(false);
    expect(titleMatchesArtist("", "Pete Rango")).toBe(false);
    expect(titleMatchesArtist("Pete Rango", "")).toBe(false);
  });
});
