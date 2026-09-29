import { describe, it, expect } from "vitest";
import { matchYoutube } from "@/lib/artists/matchYoutube";

const m = (groups: (string | undefined)[]) => ["full", ...groups] as unknown as RegExpMatchArray;

describe("matchYoutube", () => {
  it("prefers the @username group, then the plain one", () => {
    expect(matchYoutube(m([undefined, "pete", "other"]), "YouTube")).toEqual({
      siteName: "youtube",
      cardPlatformName: "YouTube",
      id: "pete",
    });
    expect(matchYoutube(m([undefined, undefined, "@pete"]), null)).toEqual({
      siteName: "youtube",
      cardPlatformName: null,
      id: "pete",
    });
  });

  it("is undefined when neither matched", () => {
    expect(matchYoutube(m(["www."]), null)).toBeUndefined();
  });
});
