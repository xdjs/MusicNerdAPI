import { describe, it, expect } from "vitest";
import { roleIsSomebodyElsesHandle } from "@/lib/credits/roleIsSomebodyElsesHandle";

describe("roleIsSomebodyElsesHandle — co-presence is not employment", () => {
  it.each([
    [
      "breath church",
      "zavodskyalan",
      "Then I went to NY to do my very first @breath.church @physiologicnyc with @sage.breath and the boys @thegreatzandini & @zavodskyalan",
    ],
    [
      "first @breath.church",
      "sage.breath",
      "Then I went to NY to do my very first @breath.church with @sage.breath",
    ],
    [
      "KIKI used for WNBA pack",
      "bycherele",
      "So apparently @bycherele KIKI is being used for @wnba Legendary In Her Bag @nbatopshot Pack Opening",
    ],
    ["opening up for @travisscott", "whoisoyabun", "@whoisoyabun opening up for @travisscott"],
  ])("rejects %s", (role, subject, quote) => {
    expect(roleIsSomebodyElsesHandle(role, subject, quote)).toBeTruthy();
  });

  it.each([
    ["Mixed by", "p3t3rango", "Mixed by @p3t3rango"],
    [
      "main production partner",
      "zavodskyalan",
      "@zavodskyalan has been one of my main production partners",
    ],
    [
      "added some 808s",
      "zavodskyalan",
      "Alan had added some 808s for the outro but those files were lost",
    ],
    ["on guitar", "someone", "@someone on guitar"],
    ["feat @dameatlas", "dameatlas", "feat @dameatlas on the second verse"],
  ])("keeps %s", (role, subject, quote) => {
    expect(roleIsSomebodyElsesHandle(role, subject, quote)).toBeNull();
  });

  it("rejects an unrelated handle that merely contains the subject's name", () => {
    expect(
      roleIsSomebodyElsesHandle(
        "the @davidcole session",
        "Cole",
        "the @davidcole session with @Cole",
      ),
    ).toBe("davidcole");
  });

  it("KNOWN LIMITATION: a bare name whose own handle is in the role is rejected", () => {
    expect(
      roleIsSomebodyElsesHandle(
        "feat @zavodskyalan",
        "Alan",
        "feat @zavodskyalan on the second verse",
      ),
    ).toBe("zavodskyalan");
  });

  it("ignores handles too short to be distinctive, and an empty role", () => {
    expect(roleIsSomebodyElsesHandle("on drums", "someone", "@abc @someone on drums")).toBeNull();
    expect(roleIsSomebodyElsesHandle("📸", "someone", "📸 @someoneelse")).toBeNull();
  });
});
