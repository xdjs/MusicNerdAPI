import { describe, it, expect } from "vitest";
import { parseMusicDestination } from "../parseMusicDestination";
import { getReleaseOwnerHandle } from "../getReleaseOwnerHandle";

describe("getReleaseOwnerHandle", () => {
  it.each([
    ["https://grimes.bandcamp.com/album/new-release", "bandcamp"],
    ["https://soundcloud.com/grimes/sets/new-release", "soundcloud"],
    ["https://subvert.fm/grimes/new-release", "subvert"],
    ["https://audius.co/grimes/album/new-release", "audius"],
    ["https://mixcloud.com/grimes/new-release/", "mixcloud"],
  ])("retains only the artist scope of %s", (url, siteName) => {
    expect(getReleaseOwnerHandle(parseMusicDestination(url)!)).toEqual({ siteName, id: "grimes" });
  });

  it.each([
    "https://open.spotify.com/album/3DmaZbBPnKSGnxYRpHobss",
    "https://deezer.com/album/123",
    "https://music.apple.com/us/album/a-release/123",
    "https://www.beatport.com/release/a-release/123",
    "https://release.supercollector.xyz/grimes-new-release",
    "https://soundcloud.com/grimes",
  ])("does not infer an artist ID from %s", url => {
    expect(getReleaseOwnerHandle(parseMusicDestination(url)!)).toBeNull();
  });
});
