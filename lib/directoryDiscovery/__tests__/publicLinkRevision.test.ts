import { it, expect } from "vitest";
import { publicLinkRevision } from "@/lib/directoryDiscovery/publicLinkRevision";

const artist = { spotify: null, deezer: "123" };
const source = {
  id: "s1",
  url: "https://music.apple.com/us/artist/test/123",
  type: "profile",
  status: "approved",
};

it("changes when a saved or source-backed destination changes", () => {
  const original = publicLinkRevision(artist, [], [], []);
  expect(original).toMatch(/^[a-f0-9]{64}$/);
  expect(publicLinkRevision({ ...artist, spotify: "abc" }, [], [], [])).not.toBe(original);
  expect(publicLinkRevision(artist, [], [source], [])).not.toBe(original);
});

it("ignores pending, hidden, uploaded and non-destination sources", () => {
  const original = publicLinkRevision(artist, [], [], []);
  expect(publicLinkRevision(artist, [], [{ ...source, status: "pending" }], [])).toBe(original);
  expect(publicLinkRevision(artist, [], [source], ["s1"])).toBe(original);
  expect(publicLinkRevision(artist, [], [{ ...source, filePath: "private/a.pdf" }], [])).toBe(
    original,
  );
  expect(
    publicLinkRevision(
      artist,
      [],
      [{ ...source, url: "https://example.com/interview", type: "article" }],
      [],
    ),
  ).toBe(original);
});
