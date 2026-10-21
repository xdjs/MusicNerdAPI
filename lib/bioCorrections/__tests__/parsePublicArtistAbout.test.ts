import { describe, it, expect } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { parsePublicArtistAbout } from "@/lib/bioCorrections/parsePublicArtistAbout";

const valid = {
  version: 1,
  identity: { name: "Bio Ritmo", accounts: {} },
  bio: "Bio Ritmo is a salsa band from Richmond.",
  kind: "researched",
  sources: [{ id: "s1", url: "https://example.com/bio-ritmo", label: "Example" }],
};

describe("parsePublicArtistAbout", () => {
  it("keeps the bio, kind and sources of a version-1 About", () => {
    expect(parsePublicArtistAbout(valid)).toEqual({
      bio: valid.bio,
      kind: "researched",
      sources: valid.sources,
    });
  });

  it.each([
    ["nothing", null],
    ["an old draft without a version", { ...valid, version: undefined }],
    ["the claim nudge", { ...valid, bio: ABOUT_EMPTY_STATE }],
    ["a bio over the limit", { ...valid, bio: "x".repeat(10_001) }],
    ["an unknown kind", { ...valid, kind: "draft" }],
    ["no sources", { ...valid, sources: [] }],
    ["too many sources", { ...valid, sources: Array(41).fill(valid.sources[0]) }],
    ["a non-http source", { ...valid, sources: [{ ...valid.sources[0], url: "ftp://x.test/a" }] }],
    ["a source without a label", { ...valid, sources: [{ id: "s1", url: "https://x.test/a" }] }],
  ])("is null for %s", (_, value) => {
    expect(parsePublicArtistAbout(value)).toBeNull();
  });
});
