import { describe, it, expect } from "vitest";
import { matchFacebook } from "@/lib/artists/matchFacebook";

const m = (groups: (string | undefined)[]) => ["full", ...groups] as unknown as RegExpMatchArray;

describe("matchFacebook", () => {
  it("reads a people or profile.php id as facebookID", () => {
    expect(matchFacebook(m(["123"]), "Facebook")).toEqual({
      siteName: "facebookID",
      cardPlatformName: "Facebook",
      id: "123",
    });
    expect(matchFacebook(m([undefined, "456"]), "Facebook")).toEqual({
      siteName: "facebookID",
      cardPlatformName: "Facebook",
      id: "456",
    });
  });

  it("reads a username, rejecting a bare profile.php", () => {
    expect(matchFacebook(m([undefined, undefined, "tyler"]), null)).toEqual({
      siteName: "facebook",
      cardPlatformName: null,
      id: "tyler",
    });
    expect(matchFacebook(m([undefined, undefined, "profile.php"]), null)).toBeNull();
  });

  it("is undefined when no group matched", () => {
    expect(matchFacebook(m([]), null)).toBeUndefined();
  });
});
