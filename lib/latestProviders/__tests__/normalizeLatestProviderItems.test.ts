import { expect, it } from "vitest";
import { normalizeLatestProviderItems } from "../normalizeLatestProviderItems";
const account = "a".repeat(22);
const address = `0x${"a".repeat(40)}`;
it("preserves catalog date precision without inventing source publication dates or credits", () => {
  const items = normalizeLatestProviderItems("spotify", account, {
    items: [
      {
        id: "b".repeat(22),
        name: "A record",
        album_type: "album",
        release_date: "2025",
        external_urls: { spotify: `https://open.spotify.com/album/${"b".repeat(22)}` },
      },
    ],
  });
  expect(items).toHaveLength(1);
  expect(items[0].original).toMatchObject({
    publishedAt: null,
    activityDate: "2025",
    activityDateKind: "release",
  });
  expect(items[0].original.text).toContain('"release_date": "2025"');
  expect(items[0].card.date).toBe("2025");
  expect(items[0].original.sourceId).toMatch(/^latest:spotify:[a-f0-9]{64}$/);
});
it("excludes appears-on releases, malformed IDs and unsafe provider URLs", () => {
  const release = {
    id: "b".repeat(22),
    name: "A",
    album_type: "single",
    release_date: "2026-02-01",
    external_urls: { spotify: `https://open.spotify.com/album/${"b".repeat(22)}` },
  };
  expect(
    normalizeLatestProviderItems("spotify", account, {
      items: [
        { ...release, album_group: "appears_on" },
        { ...release, id: "bad" },
        { ...release, external_urls: { spotify: "https://evil.example" } },
      ],
    }),
  ).toEqual([]);
});
it("filters hidden moments and retains exact title separately from description, not transcript", () => {
  const moment = {
    id: "moment-1",
    address: `0x${"b".repeat(40)}`,
    token_id: 3,
    chain_id: 8453,
    created_at: "2026-10-08T14:15:12Z",
    metadata: {
      name: "Plugin experiments",
      description: "My new sketch",
      content: { mime: "video/mp4" },
    },
  };
  const items = normalizeLatestProviderItems("inprocess", address, {
    moments: [moment, { ...moment, id: "hidden", hidden: [address.toUpperCase()] }],
  });
  expect(items).toHaveLength(1);
  expect(items[0].card).toMatchObject({
    title: "Plugin experiments",
    text: "My new sketch",
    momentKind: "video",
  });
  expect(items[0].original.text).toContain('"description": "My new sketch"');
  expect(items[0].original.text).not.toContain("transcript");
  expect(items[0].original.url).toBe(
    `https://www.inprocess.world/collect/base:0x${"b".repeat(40)}/3`,
  );
});
it("revisions change for original edits but source identity is stable", () => {
  const release = {
    id: 12,
    title: "Record",
    record_type: "ep",
    release_date: "2025-10",
    link: "https://www.deezer.com/album/12",
  };
  const [a] = normalizeLatestProviderItems("deezer", "42", { data: [release] });
  const [b] = normalizeLatestProviderItems("deezer", "42", {
    data: [{ ...release, title: "Corrected record" }],
  });
  expect(a.original.sourceId).toBe(b.original.sourceId);
  expect(a.original.revision).not.toBe(b.original.revision);
});
