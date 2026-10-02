import { describe, it, expect } from "vitest";
import { deriveNameSlugs } from "@/lib/discovery/deriveNameSlugs";

describe("deriveNameSlugs", () => {
  it("derives concatenated, hyphenated, dot- and underscore-joined variants for a two-word name", () => {
    expect(deriveNameSlugs("Pete Rango")).toEqual([
      "peterango",
      "pete-rango",
      "pete.rango",
      "pete_rango",
    ]);
  });

  it("derives just a plain slug for a single-word name", () => {
    expect(deriveNameSlugs("Whilst")).toEqual(["whilst"]);
  });

  it("never combinatorially explodes for a many-word name", () => {
    expect(deriveNameSlugs("The Artist Formerly Known As Prince")).toEqual([
      "theartistformerlyknownasprince",
      "the-artist-formerly-known-as-prince",
    ]);
  });

  it("is case-, accent- and punctuation-insensitive and dedupes", () => {
    expect(deriveNameSlugs("Sigur Rós!")).toEqual([
      "sigurros",
      "sigur-ros",
      "sigur.ros",
      "sigur_ros",
    ]);
    expect(deriveNameSlugs("!!!")).toEqual([]);
  });
});
