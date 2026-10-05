import { adoptMusicDestinations } from "../adoptMusicDestinations";
import { beforeEach, expect, it, vi } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
const m = vi.hoisted(() => ({ fetch: vi.fn(), insert: vi.fn(), ambiguous: vi.fn() }));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent: m.fetch }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insert }));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: m.ambiguous,
}));
const apple = "https://music.apple.com/us/artist/grimes/123";
const beatport = "https://www.beatport.com/artist/grimes/456";
beforeEach(() => {
  m.fetch
    .mockReset()
    .mockResolvedValue({ status: 200, title: "Grimes", extractedText: "Grimes ".repeat(100) });
  m.insert.mockReset().mockImplementation(async data => ({ id: data.url, ...data }));
  m.ambiguous.mockReset().mockResolvedValue(false);
});
it("retains MusicBrainz catalog URLs as reviewable original URLs", async () => {
  const run = searchRun();
  await adoptMusicDestinations(run, [apple, beatport], "identifier");
  expect(m.insert.mock.calls.map(([data]) => [data.url, data.type, data.status])).toEqual([
    [apple, "music", "pending"],
    [beatport, "music", "pending"],
  ]);
  expect(run.saved).toHaveLength(2);
});
it("does not adopt a namesake, dead page, non-artist catalog page or ambiguous platform", async () => {
  const run = searchRun();
  m.fetch
    .mockResolvedValueOnce({ status: 200, title: "Someone Else" })
    .mockResolvedValueOnce({ status: 404, title: "Grimes" });
  await adoptMusicDestinations(
    run,
    [apple, beatport, "https://music.apple.com/album/release/999"],
    "own-page",
  );
  expect(m.insert).not.toHaveBeenCalled();
  m.ambiguous.mockResolvedValueOnce(true);
  await adoptMusicDestinations(run, [apple], "name");
  expect(m.insert).not.toHaveBeenCalled();
  m.ambiguous.mockResolvedValue(false);
  await adoptMusicDestinations(run, [apple, "https://music.apple.com/artist/999"], "identifier");
  expect(m.insert).not.toHaveBeenCalled();
});
it("preserves rejected/existing URLs and source-write skips, and checks the deadline after the fetch", async () => {
  const run = searchRun({ existingUrls: new Set([apple.replace("https://", "")]) });
  await adoptMusicDestinations(run, [apple], "identifier");
  expect(m.fetch).not.toHaveBeenCalled();
  m.insert.mockResolvedValueOnce(undefined);
  await adoptMusicDestinations(run, [beatport], "identifier");
  expect(run.saved).toHaveLength(0);
  const expired = searchRun();
  m.fetch.mockImplementationOnce(async () => {
    expired.deadline = Date.now() - 1;
    return { status: 200, title: "Grimes" };
  });
  m.insert.mockClear();
  await adoptMusicDestinations(expired, [apple], "identifier");
  expect(m.insert).not.toHaveBeenCalled();
});
it("propagates failed writes for durable jobs instead of silently losing the candidate", async () => {
  m.insert.mockRejectedValueOnce(new Error("write failed"));
  await expect(
    adoptMusicDestinations(searchRun({ requireComplete: true }), [apple], "identifier"),
  ).rejects.toThrow("write failed");
});

it("validates each catalog relation even when MusicBrainz matched a trusted identifier", async () => {
  m.fetch.mockResolvedValueOnce({
    status: 200,
    title: "Someone Else",
    extractedText: "Their catalog",
  });
  await adoptMusicDestinations(searchRun(), [apple, beatport], "identifier");
  expect(m.insert.mock.calls.map(([data]) => data.url)).toEqual([beatport]);
  m.insert.mockClear();
  m.ambiguous.mockResolvedValueOnce(true);
  await adoptMusicDestinations(searchRun(), [apple], "identifier");
  expect(m.insert).not.toHaveBeenCalled();
});

const catalog = [
  apple,
  beatport,
  "https://open.spotify.com/artist/3DmaZbBPnKSGnxYRpHobss",
  "https://deezer.com/artist/123",
  "https://tidal.com/artist/123",
  "https://open.qobuz.com/artist/123",
  "https://music.amazon.com/artists/B0012345AB",
  "https://grimes.bandcamp.com",
  "https://subvert.fm/grimes",
  "https://soundcloud.com/grimes",
];

it.each(["identifier", "own-page"] as const)(
  "checks a new tenth relation before existing targets (%s)",
  async evidence => {
    const run = searchRun({
      existingUrls: new Set(catalog.slice(0, 9).map(normalizeLoreDiscoveryUrl)),
    });
    await adoptMusicDestinations(run, catalog, evidence);
    expect(m.fetch.mock.calls[0][0]).toBe(catalog[9]);
    expect(m.fetch.mock.calls.length).toBeLessThanOrEqual(9);
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ url: catalog[9] }));
  },
);

it("counts unique destinations rather than duplicate relation URLs toward the fetch cap", async () => {
  await adoptMusicDestinations(searchRun(), [...Array(9).fill(apple), beatport], "identifier");
  expect(m.fetch.mock.calls.map(([url]) => url)).toEqual([apple, beatport]);
});

it("retains the nine-fetch ceiling for new destinations", async () => {
  await adoptMusicDestinations(searchRun(), catalog, "identifier");
  expect(m.fetch).toHaveBeenCalledTimes(9);
});

it.each([
  ["Black Dave", "Dave"],
  ["Dave", "Black Dave"],
  ["AB", "Gabrielle"],
  ["Black Dave", "Dave - Apple Music"],
  ["Dave", "Black Dave - Apple Music"],
])("rejects a partial catalog identity for %s (%s)", async (artistName, title) => {
  m.fetch.mockResolvedValueOnce({
    status: 200,
    title,
    extractedText: "Unrelated profile ".repeat(100),
  });
  await adoptMusicDestinations(searchRun({ artistName }), [apple], "identifier");
  expect(m.insert).not.toHaveBeenCalled();
});
it.each([
  [apple, "Black Dave — Apple Music"],
  [beatport, "Black Dave | Beatport"],
])("accepts the full name with the expected catalog decoration (%s)", async (url, title) => {
  m.fetch.mockResolvedValueOnce({ status: 200, title });
  await adoptMusicDestinations(searchRun({ artistName: "Black Dave" }), [url], "identifier");
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ url, title, type: "music" }));
});
