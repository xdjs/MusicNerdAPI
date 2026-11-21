import { describe, it, expect } from "vitest";
import { reciprocalSourceLabel } from "@/lib/addArtist/reciprocalSourceLabel";

describe("reciprocalSourceLabel", () => {
  it("names the public record", () => {
    expect(
      reciprocalSourceLabel({
        platform: "deezer",
        platformId: "1",
        source: "wikidata",
        wikidataId: "Q1",
      }),
    ).toBe("Wikidata");
    expect(
      reciprocalSourceLabel({
        platform: "deezer",
        platformId: "1",
        source: "musicbrainz",
        musicbrainzId: "m",
      }),
    ).toBe("MusicBrainz");
  });
});
