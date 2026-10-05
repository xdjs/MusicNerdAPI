import { describe, it, expect } from "vitest";
import { hit, searchRun } from "@/lib/vault/__tests__/searchRun";
import { filterCandidates } from "@/lib/vault/filterCandidates";

describe("filterCandidates", () => {
  it("drops known profiles, feeds, scrape farms, LinkedIn, unsafe URLs and ones we already have", () => {
    const run = searchRun({
      artist: { id: "a1", name: "Grimes", spotify: "3DmaZbBPnKSGnxYRpHobss" },
      existingUrls: new Set(["example.com/old", "example.com/rejected"]),
    });
    const kept = filterCandidates(
      run,
      [
        hit("https://open.spotify.com/artist/3DmaZbBPnKSGnxYRpHobss"),
        hit("https://example.com/press.rss"),
        hit("https://www.boomplay.com/artists/1"),
        hit("https://www.linkedin.com/in/grimes"),
        hit("http://127.0.0.1/admin"),
        hit("https://example.com/old"),
        hit("https://example.com/rejected"),
        hit("https://example.com/new"),
        hit("https://example.com/new"),
      ],
      new Set(["example.com/rejected"]),
    );
    expect(kept.map(r => r.url)).toEqual(["https://example.com/new"]);
    expect(run.counts).toEqual({ skipped: 7, dropped: 0, rejectedSkips: 1 });
    expect(run.existingUrls.has("example.com/new")).toBe(true);
  });
});

it("retains new releases while keeping rejected releases and known profiles filtered", () => {
  const run = searchRun({
    artist: { bandcamp: "grimes" },
    existingUrls: new Set(["grimes.bandcamp.com/album/rejected"]),
  });
  const results = filterCandidates(
    run,
    [
      hit("https://grimes.bandcamp.com/"),
      hit("https://grimes.bandcamp.com/album/new"),
      hit("https://grimes.bandcamp.com/album/rejected"),
    ],
    new Set(["grimes.bandcamp.com/album/rejected"]),
  );
  expect(results.map(r => r.url)).toEqual(["https://grimes.bandcamp.com/album/new"]);
  expect(run.counts.rejectedSkips).toBe(1);
});
