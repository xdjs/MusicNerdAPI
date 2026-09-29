import { describe, it, expect } from "vitest";
import { isSpotifyUrl } from "@/lib/pages/isSpotifyUrl";

describe("isSpotifyUrl", () => {
  it("matches open.spotify.com only", () => {
    expect(isSpotifyUrl("https://open.spotify.com/artist/x")).toBe(true);
    expect(isSpotifyUrl("https://OPEN.SPOTIFY.COM/artist/x")).toBe(true);
    expect(isSpotifyUrl("https://spotify.com/x")).toBe(false);
    expect(isSpotifyUrl("nope")).toBe(false);
  });
});
