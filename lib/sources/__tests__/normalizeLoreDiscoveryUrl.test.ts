import { describe, it, expect } from "vitest";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";

const apple = "https://podcasts.apple.com/tw/podcast/episode/id1877956390?i=1000780276007&l=en-GB";

describe("normalizeLoreDiscoveryUrl", () => {
  it("drops www, case, trailing slashes and tracking params", () => {
    expect(normalizeLoreDiscoveryUrl("https://WWW.Example.com/A/B/?utm=1#x")).toBe(
      "example.com/a/b",
    );
  });

  it("keeps Apple's episode id but ignores its tracking parameters", () => {
    expect(normalizeLoreDiscoveryUrl(apple)).not.toBe(
      normalizeLoreDiscoveryUrl(apple.replace("6007", "6008")),
    );
    expect(normalizeLoreDiscoveryUrl(apple)).toBe(
      normalizeLoreDiscoveryUrl(apple.replace("&l=en-GB", "&l=fr-FR")),
    );
  });

  it("falls back to string cleanup for an unparseable URL", () => {
    expect(normalizeLoreDiscoveryUrl("HTTP://www.Odd Url/")).toBe("odd url");
  });
});
