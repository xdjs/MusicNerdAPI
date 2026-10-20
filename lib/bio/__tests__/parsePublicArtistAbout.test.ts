import { describe, it, expect } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { parsePublicArtistAbout } from "@/lib/bio/parsePublicArtistAbout";

const source = { id: "s1", url: "https://example.com/a", label: "Interview" };
const valid = { version: 1, bio: "Pete is a producer.", kind: "researched", sources: [source] };

describe("parsePublicArtistAbout", () => {
  it("reads a version 1 About", () => {
    expect(parsePublicArtistAbout({ ...valid, extra: true })).toEqual({
      bio: "Pete is a producer.",
      kind: "researched",
      sources: [source],
    });
  });

  it.each([
    ["null", null],
    ["no version", { ...valid, version: undefined }],
    ["the empty state", { ...valid, bio: ABOUT_EMPTY_STATE }],
    ["an unknown kind", { ...valid, kind: "draft" }],
    ["no sources", { ...valid, sources: [] }],
    ["41 sources", { ...valid, sources: Array(41).fill(source) }],
    ["a non-http source", { ...valid, sources: [{ ...source, url: "ftp://x.com" }] }],
    ["a long label", { ...valid, sources: [{ ...source, label: "x".repeat(501) }] }],
  ])("is null for %s", (_label, value) => {
    expect(parsePublicArtistAbout(value)).toBeNull();
  });
});
