import { it, expect } from "vitest";
import { isDestinationSource } from "@/lib/links/isDestinationSource";

it.each([
  [{ url: "https://music.apple.com/us/artist/pete-rango/1513734272", type: "profile" }, true],
  [{ url: "https://music.apple.com/us/album/rush/123", type: "profile" }, false],
  [{ url: "https://peterango.com/", type: "website" }, true],
  [{ url: "https://pitchfork.com/reviews/x", type: "review" }, false],
  [{ url: "https://soundcloud.com/show", type: "audio" }, false],
  [{ url: "https://music.apple.com/us/artist/x/1", podcastEpisodeKey: "e" }, false],
])("%j → %s", (source, expected) => {
  expect(isDestinationSource(source)).toBe(expected);
});
