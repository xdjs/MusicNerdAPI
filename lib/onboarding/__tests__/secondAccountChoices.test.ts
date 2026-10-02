import { describe, it, expect } from "vitest";
import { profile } from "@/lib/onboarding/__tests__/profile";
import { secondAccountChoices } from "@/lib/onboarding/secondAccountChoices";

const urlmap = [
  {
    siteName: "instagram",
    cardPlatformName: "Instagram",
    siteImage: null,
    colorHex: null,
    appStringFormat: "https://instagram.com/%@",
  },
  {
    siteName: "discogs",
    cardPlatformName: "Discogs",
    siteImage: null,
    colorHex: null,
    appStringFormat: null,
  },
];

describe("secondAccountChoices", () => {
  it("asks which account is theirs when the search replaced a guessed column", () => {
    const guessed = profile("instagram", "blackdavemk2", { provisional: true });
    const choices = secondAccountChoices(
      ["instagram"],
      new Map([["instagram", guessed]]),
      { instagram: "blackdave.xyz" },
      urlmap,
    );
    expect(choices).toEqual([
      {
        kind: "choices",
        platform: "instagram",
        chosen: "blackdave.xyz",
        options: [
          {
            ...guessed,
            value: "blackdave.xyz",
            profileUrl: "https://instagram.com/blackdave.xyz",
            displayName: "Instagram",
          },
          guessed,
        ],
      },
    ]);
  });

  it("asks nothing when the guess stood, the column emptied, or there's no profile URL", () => {
    const g = profile("instagram", "same");
    expect(
      secondAccountChoices(
        ["instagram"],
        new Map([["instagram", g]]),
        { instagram: "same" },
        urlmap,
      ),
    ).toEqual([]);
    expect(
      secondAccountChoices(["instagram"], new Map([["instagram", g]]), { instagram: null }, urlmap),
    ).toEqual([]);
    expect(
      secondAccountChoices(
        ["discogs"],
        new Map([["discogs", profile("discogs")]]),
        { discogs: "123" },
        urlmap,
      ),
    ).toEqual([]);
    expect(secondAccountChoices(["instagram"], new Map(), { instagram: "x" }, urlmap)).toEqual([]);
    expect(
      secondAccountChoices(["instagram"], new Map([["instagram", g]]), undefined, urlmap),
    ).toEqual([]);
  });
});
