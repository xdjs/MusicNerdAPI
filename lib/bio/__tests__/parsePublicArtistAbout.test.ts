import { describe, expect, it } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { parsePublicArtistAbout } from "@/lib/bio/parsePublicArtistAbout";

const about = {
  version: 1,
  bio: "A real About.",
  kind: "researched",
  sources: [{ id: "s1", url: "https://example.com/a", label: "Example" }],
};

describe("parsePublicArtistAbout", () => {
  it("returns only the public fields of a versioned About", () => {
    expect(parsePublicArtistAbout({ ...about, identity: { name: "x" }, extra: 1 })).toEqual({
      bio: "A real About.",
      kind: "researched",
      sources: [{ id: "s1", url: "https://example.com/a", label: "Example" }],
    });
  });

  it("refuses anything that is not an explicit version-1 About with real sources", () => {
    expect(parsePublicArtistAbout(null)).toBeNull();
    expect(parsePublicArtistAbout({ ...about, version: 2 })).toBeNull();
    expect(parsePublicArtistAbout({ ...about, bio: ABOUT_EMPTY_STATE })).toBeNull();
    expect(parsePublicArtistAbout({ ...about, kind: "draft" })).toBeNull();
    expect(parsePublicArtistAbout({ ...about, sources: [] })).toBeNull();
    expect(
      parsePublicArtistAbout({ ...about, sources: [{ id: "s1", url: "ftp://x", label: "l" }] }),
    ).toBeNull();
    expect(
      parsePublicArtistAbout({
        ...about,
        sources: [{ id: "s1", url: "https://example.com", label: "l".repeat(501) }],
      }),
    ).toBeNull();
  });
});
