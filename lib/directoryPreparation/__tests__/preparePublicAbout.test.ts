import { expect, it } from "vitest";
import { preparePublicAbout } from "../preparePublicAbout";
import type { DirectoryMaterial } from "../types";
const material: DirectoryMaterial = {
  artistName: "Xcelencia",
  startingBio: null,
  manifest: [
    {
      id: "first",
      artistId: "artist",
      url: "https://example.com/interview",
      title: "Interview",
      extractedText: "original",
      publishedAt: null,
      status: "pending",
    },
    {
      id: "second",
      artistId: "artist",
      url: "https://example.org/bio",
      title: "Biography",
      extractedText: "original two",
      publishedAt: null,
      status: "pending",
      type: "website",
    },
  ],
};
it("publishes plain prose and only the actual cited sources, never the originals", () => {
  expect(
    preparePublicAbout(material, {
      status: "ready",
      document: "Private [1][2]",
      about: "An electronic artist [2].",
    }),
  ).toEqual({
    version: 1,
    identity: { name: "Xcelencia", accounts: {} },
    bio: "An electronic artist.",
    kind: "researched",
    sources: [{ id: "second", url: "https://example.org/bio", label: "Biography" }],
  });
});
it("does not call a heuristic website source official", () => {
  expect(
    preparePublicAbout(material, { status: "ready", document: "[2]", about: "Xcelencia[2]." })
      ?.kind,
  ).toBe("researched");
});
it("withholds unsupported, unknown-citation and empty outputs", () => {
  for (const about of ["Unsupported", "Unknown[3]", "[1]", "Mixed[1][9]"])
    expect(preparePublicAbout(material, { status: "ready", document: "[1]", about })).toBeNull();
  expect(
    preparePublicAbout(material, { status: "insufficient", document: null, about: null }),
  ).toBeNull();
});
it("withholds namesake evidence excluded by assessment", () => {
  expect(
    preparePublicAbout(
      { ...material, manifest: [] },
      { status: "ready", document: "[1]", about: "The other Xcelencia[1]." },
    ),
  ).toBeNull();
});
it("withholds unsafe cited URLs instead of silently dropping their attribution", () => {
  for (const url of [
    "http://127.0.0.1/private",
    "https://user:secret@example.com",
    "javascript:alert(1)",
  ])
    expect(
      preparePublicAbout(
        { ...material, manifest: [{ ...material.manifest[0], url }] },
        { status: "ready", document: "[1]", about: "Biography[1]." },
      ),
    ).toBeNull();
});
