import { describe, it, expect } from "vitest";
import { matchYoutubeChannel } from "@/lib/artists/matchYoutubeChannel";

const m = (groups: (string | undefined)[]) => ["full", ...groups] as unknown as RegExpMatchArray;

describe("matchYoutubeChannel", () => {
  it("prefers the channel id, then an @username, then a plain username", () => {
    expect(matchYoutubeChannel(m([undefined, "UC1"]), "YouTube")).toEqual({
      siteName: "youtubechannel",
      cardPlatformName: "YouTube",
      id: "UC1",
    });
    expect(matchYoutubeChannel(m([undefined, undefined, "@pete"]), "YouTube")).toEqual({
      siteName: "youtube",
      cardPlatformName: "YouTube",
      id: "pete",
    });
    expect(matchYoutubeChannel(m([undefined, undefined, undefined, "pete"]), null)).toEqual({
      siteName: "youtube",
      cardPlatformName: null,
      id: "pete",
    });
  });

  it("is undefined when no group matched, so the generic reading runs", () => {
    expect(matchYoutubeChannel(m([]), null)).toBeUndefined();
  });
});
