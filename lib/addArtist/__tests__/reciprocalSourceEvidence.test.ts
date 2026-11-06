import { describe, it, expect } from "vitest";
import { reciprocalSourceEvidence } from "@/lib/addArtist/reciprocalSourceEvidence";

describe("reciprocalSourceEvidence", () => {
  it("names the record and its id", () => {
    expect(
      reciprocalSourceEvidence({
        platform: "deezer",
        platformId: "1",
        source: "wikidata",
        wikidataId: "Q1",
      }),
    ).toBe("Wikidata Q1");
    expect(
      reciprocalSourceEvidence({
        platform: "deezer",
        platformId: "1",
        source: "musicbrainz",
        musicbrainzId: "m",
      }),
    ).toBe("MusicBrainz m");
  });
});
