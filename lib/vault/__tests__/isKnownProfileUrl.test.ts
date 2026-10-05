import { describe, it, expect } from "vitest";
import { isKnownProfileUrl } from "@/lib/vault/isKnownProfileUrl";

describe("isKnownProfileUrl", () => {
  it.each(["AAAAAAAAAAAAAAAAAAAAAA", "https://open.spotify.com/artist/AAAAAAAAAAAAAAAAAAAAAA"])(
    "compares a held Spotify identity without folding case (%s)",
    spotify => {
      expect(
        isKnownProfileUrl("https://open.spotify.com/artist/AAAAAAAAAAAAAAAAAAAAAA", { spotify }),
      ).toBe(true);
      expect(
        isKnownProfileUrl("https://open.spotify.com/artist/aaaaaaaaaaaaaaaaaaaaaa", { spotify }),
      ).toBe(false);
    },
  );
  it("recognises a profile we already hold as a link, on its own platform", () => {
    const artist = { spotify: "3DmaZbBPnKSGnxYRpHobss", youtube: "p3t3rango" };
    expect(
      isKnownProfileUrl("https://open.spotify.com/artist/3DmaZbBPnKSGnxYRpHobss", artist),
    ).toBe(true);
    // Other content on the same host is not the profile.
    expect(isKnownProfileUrl("https://www.youtube.com/watch?v=GvqK4m2i9Mc", artist)).toBe(false);
  });

  it("recognises a profile stored as a whole url, read by row property", () => {
    const artist = { facebookId: "https://www.facebook.com/people/Grimes/100044180243805/" };
    expect(
      isKnownProfileUrl("https://www.facebook.com/profile.php?id=100044180243805", artist),
    ).toBe(true);
  });

  it("needs the handle on its own platform, so a handle in someone's domain is not it", () => {
    expect(isKnownProfileUrl("https://dupes.rocks/", { bandcamp: "dupes" })).toBe(false);
  });

  it("ignores values too short to identify anything, and unparseable urls", () => {
    expect(isKnownProfileUrl("https://x.com/abc", { x: "abc" })).toBe(false);
    expect(isKnownProfileUrl("not a url", { x: "p3t3rango" })).toBe(false);
  });
});

it.each([
  ["bandcamp", "https://grimes.bandcamp.com/album/new-release"],
  ["soundcloud", "https://soundcloud.com/grimes/new-release"],
  ["audius", "https://audius.co/grimes/new-release"],
  ["mixcloud", "https://www.mixcloud.com/grimes/new-release/"],
  ["subvert", "https://subvert.fm/grimes/new-release"],
])("keeps a release distinct from the known %s profile", (platform, url) => {
  expect(isKnownProfileUrl(url, { [platform]: "grimes" })).toBe(false);
});
