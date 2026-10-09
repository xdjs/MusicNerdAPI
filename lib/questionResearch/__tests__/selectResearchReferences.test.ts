import { it, expect } from "vitest";
import { selectResearchReferences } from "@/lib/questionResearch/selectResearchReferences";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
const original: ResearchOriginal = {
  sourceId: "vault:1",
  revision: "a".repeat(64),
  text:
    "Opening context. " +
    "Unrelated paragraph. ".repeat(1000) +
    " DAY 002 production: The proposed drums were not used on the final recording. ",
  url: "https://artist.example/credits",
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "unverified",
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
};
it("searches deep originals and retains nearby qualifications", () => {
  const r = selectResearchReferences(
    [original],
    { topic: "DAY 002 drums", evidenceNeed: "credits", freshness: "stored" },
    "Artist",
  );
  expect(r[0].text).toContain("not used");
  expect(r[0].start).toBeGreaterThan(10000);
  expect(original.text.slice(r[0].start, r[0].end)).toBe(r[0].text);
});
it("never treats a caption as requested speech", () => {
  expect(
    selectResearchReferences(
      [{ ...original, evidenceKind: "caption" }],
      { topic: "DAY 002", evidenceNeed: "spoken_content", freshness: "stored" },
      "Artist",
    ),
  ).toEqual([]);
});
it("respects exact targets and publication-date bounds without inventing event dates", () => {
  expect(
    selectResearchReferences(
      [original],
      {
        topic: "DAY 002",
        evidenceNeed: "credits",
        freshness: "stored",
        targetUrl: "https://artist.example/other",
      },
      "Artist",
    ),
  ).toEqual([]);
  expect(
    selectResearchReferences(
      [original],
      { topic: "DAY 002", evidenceNeed: "credits", freshness: "recent", fromDate: "2026-10-01" },
      "Artist",
    ),
  ).toEqual([]);
});

it("opens an exact target even when the question paraphrases its wording", () => {
  const text = "A handmade synthesizer made the first record possible.";
  const r = selectResearchReferences(
    [{ ...original, text }],
    {
      topic: "What inspired this?",
      evidenceNeed: "reporting",
      freshness: "stored",
      targetUrl: original.url + "?utm_source=share",
    },
    "Artist",
  );
  expect(r[0]?.text).toBe(text);
  expect(r[0]?.start).toBe(0);
});
it("honors an explicitly requested platform when checking saved public evidence", () => {
  const r = selectResearchReferences(
    [{ ...original, url: "https://www.tiktok.com/@artist/video/123", text: "OUT HERE album" }],
    { topic: "OUT HERE album", evidenceNeed: "social_caption", freshness: "stored", platform: "x" },
    "Artist",
  );
  expect(r).toEqual([]);
});
it("does not let one long interview crowd a relevant short original out of public research", () => {
  const long = {
    ...original,
    sourceId: "vault:long",
    text: Array.from(
      { length: 40 },
      (_, i) =>
        `Interview section ${i}. Music music music sound sound. ` +
        "A discussion of creative work. ".repeat(35),
    ).join("\n"),
  };
  const bio = {
    ...original,
    sourceId: "vault:bio",
    url: "https://artist.example/bio",
    text: "The artist's music moves between hip hop, club and jazz.",
  };
  const r = selectResearchReferences(
    [long, bio],
    { topic: "music sound", evidenceNeed: "reporting", freshness: "stored" },
    "Artist",
  );
  expect(r.some(p => p.sourceId === bio.sourceId)).toBe(true);
  expect(r.filter(p => p.sourceId === long.sourceId).length).toBeLessThanOrEqual(2);
});
it("counts a promoted discovery and its identical approved Lore copy as one original", () => {
  const long = {
    ...original,
    sourceId: "vault:long",
    text: Array.from(
      { length: 40 },
      (_, i) =>
        `Interview section ${i}. Music music music sound sound. ` +
        "A discussion of creative work. ".repeat(35),
    ).join("\n"),
  };
  const duplicate = { ...long, sourceId: "discovery:copy", curation: "pending" as const };
  const bio = {
    ...original,
    sourceId: "vault:bio",
    url: "https://artist.example/bio",
    text: "The artist music moves between hip hop, club and jazz.",
  };
  const result = selectResearchReferences(
    [duplicate, long, bio],
    { topic: "music sound", evidenceNeed: "reporting", freshness: "stored" },
    "Artist",
  );
  expect(result.some(r => r.sourceId === bio.sourceId)).toBe(true);
  expect(result.some(r => r.sourceId === duplicate.sourceId)).toBe(false);
});

const now = Date.parse("2026-10-09T04:00:00Z");
const latestRequest = {
  topic: "latest updates",
  evidenceNeed: "reporting",
  freshness: "recent",
  retrieval: "latest",
} as const;
it("reads newest available originals without keyword overlap or a seven-day cutoff", () => {
  const dated = ["2026-09-01", "2026-09-29", "2026-09-15"].map((publishedAt, i) => ({
    ...original,
    sourceId: `post:${i}`,
    url: `https://instagram.com/p/${i}`,
    publishedAt,
    text: `I built a handmade synthesizer for recording number ${i}.`,
  }));
  const refs = selectResearchReferences(dated, latestRequest, "Artist", now);
  expect(refs.map(r => r.publishedAt)).toEqual(["2026-09-29", "2026-09-15", "2026-09-01"]);
  expect(
    refs.every(
      r => dated.find(o => o.sourceId === r.sourceId)?.text.slice(r.start, r.end) === r.text,
    ),
  ).toBe(true);
});
it("latest never ranks future, undated, invalid dates or unrelated platforms as newest", () => {
  const dated = [null, "invalid", "2026-10-10", "2026-10-08"].map((publishedAt, i) => ({
    ...original,
    sourceId: `post:${i}`,
    url: `https://instagram.com/p/${i}`,
    publishedAt,
  }));
  const refs = selectResearchReferences(
    [
      ...dated,
      {
        ...original,
        sourceId: "x:1",
        url: "https://x.com/artist/status/1",
        publishedAt: "2026-10-09",
      },
    ],
    { ...latestRequest, platform: "instagram" },
    "Artist",
    now,
  );
  expect(refs.map(r => r.sourceId)).toEqual(["post:3"]);
});
it("latest preserves explicit date and speech boundaries", () => {
  const dated = { ...original, publishedAt: "2026-09-29", evidenceKind: "caption" as const };
  expect(
    selectResearchReferences([dated], { ...latestRequest, fromDate: "2026-10-01" }, "Artist", now),
  ).toEqual([]);
  expect(
    selectResearchReferences(
      [dated],
      { ...latestRequest, evidenceNeed: "spoken_content" },
      "Artist",
      now,
    ),
  ).toEqual([]);
});
it("latest windows stay bounded and topic relevance remains unchanged", () => {
  const dated = Array.from({ length: 10 }, (_, i) => ({
    ...original,
    sourceId: `post:${i}`,
    url: `https://instagram.com/p/${i}`,
    publishedAt: "2026-10-08",
    text: "A handmade synthesizer. ".repeat(1000),
  }));
  const refs = selectResearchReferences(dated, latestRequest, "Artist", now);
  expect(refs).toHaveLength(3);
  expect(refs.reduce((sum, r) => sum + r.text.length, 0)).toBeLessThanOrEqual(12000);
  expect(
    selectResearchReferences(dated, { ...latestRequest, retrieval: "relevance" }, "Artist", now),
  ).toEqual([]);
});
it("retains full publication precision when a promoted Lore copy loses the original time", () => {
  const post = {
    ...original,
    sourceId: "discovery:dated",
    text: "A new handmade synthesizer.",
    publishedAt: "2026-10-08T18:00:00Z",
  };
  const promoted = { ...post, sourceId: "vault:promoted", publishedAt: "2026-10-08" };
  const other = {
    ...post,
    sourceId: "social:earlier",
    url: "https://instagram.com/p/earlier",
    publishedAt: "2026-10-08T10:00:00Z",
  };
  expect(
    selectResearchReferences([promoted, other, post], latestRequest, "Artist", now).map(
      r => r.sourceId,
    ),
  ).toEqual(["discovery:dated", "social:earlier"]);
  expect(
    selectResearchReferences(
      [{ ...promoted, publishedAt: null }, post],
      latestRequest,
      "Artist",
      now,
    )[0].sourceId,
  ).toBe("discovery:dated");
});

it("ranks release/moment activity alongside posts without relabelling activity as publication", () => {
  const moment: ResearchOriginal = {
    ...original,
    sourceId: "latest:inprocess:1",
    text: "Plugin experiments",
    url: "https://www.inprocess.world/moment/1",
    activityDate: "2026-10-08T14:15:12Z",
    activityDateKind: "moment",
  };
  const release: ResearchOriginal = {
    ...original,
    sourceId: "latest:spotify:1",
    text: "Release date 2026-09",
    url: "https://open.spotify.com/album/1",
    activityDate: "2026-09",
    activityDateKind: "release",
  };
  const future = {
    ...release,
    sourceId: "latest:spotify:2",
    url: "https://open.spotify.com/album/2",
    activityDate: "2026-10",
  };
  const refs = selectResearchReferences([release, moment, future], latestRequest, "Artist", now);
  expect(refs.map(r => r.sourceId)).toEqual([moment.sourceId, release.sourceId]);
  expect(refs.every(r => r.publishedAt === null)).toBe(true);
  expect(refs[1].activityDate).toBe("2026-09");
});

it.each([
  ["inprocess", "https://www.inprocess.world/collect/base:abc/2"],
  ["spotify", "https://open.spotify.com/album/abc"],
  ["deezer", "https://www.deezer.com/album/123"],
] as const)("retrieves only exact %s hosts for latest", (platform, url) => {
  const item = { ...original, text: "Exact original", publishedAt: "2026-10-01T00:00:00Z", url };
  const unrelated = {
    ...item,
    sourceId: "other",
    url: "https://www.tiktok.com/@example/video/123",
  };
  const spoof = {
    ...item,
    sourceId: "spoof",
    url: url.replace(new URL(url).hostname, new URL(url).hostname + ".evil.example"),
  };
  const request = {
    topic: "latest",
    evidenceNeed: "reporting",
    freshness: "stored",
    retrieval: "latest",
    platform,
  } as const;
  expect(
    selectResearchReferences([item, unrelated, spoof], request, "Artist", Date.parse("2026-10-09")),
  ).toMatchObject([{ url }]);
  expect(
    selectResearchReferences(
      [unrelated],
      { ...request, targetUrl: unrelated.url },
      "Artist",
      Date.parse("2026-10-09"),
    ),
  ).toEqual([]);
});

it("prefers eligible release dates over newer posts only for latest release requests", () => {
  const release = {
    ...original,
    sourceId: "latest:spotify:1",
    url: "https://open.spotify.com/album/abc",
    text: '"releaseDate":"2026-09-25"',
    activityDate: "2026-09-25",
    activityDateKind: "release" as const,
  };
  const moment = {
    ...original,
    sourceId: "latest:inprocess:2",
    url: "https://www.inprocess.world/collect/base:abc/2",
    text: "Experimenting with plugins",
    activityDate: "2026-10-08T12:00:00Z",
    activityDateKind: "moment" as const,
  };
  const request = {
    topic: "latest release",
    evidenceNeed: "release_date",
    freshness: "stored",
    retrieval: "latest",
  } as const;
  const now = Date.parse("2026-10-09");
  expect(
    selectResearchReferences([moment, release], request, "Pete", now).map(r => r.sourceId),
  ).toEqual([release.sourceId]);
  expect(
    selectResearchReferences(
      [moment, release],
      { ...request, evidenceNeed: "reporting" },
      "Pete",
      now,
    )[0].sourceId,
  ).toBe(moment.sourceId);
  const scoped = selectResearchReferences(
    [moment, release],
    { ...request, platform: "inprocess" },
    "Pete",
    now,
  );
  expect(scoped.map(r => r.sourceId)).toEqual([moment.sourceId]);
  expect(scoped[0].activityDateKind).toBe("moment");
  expect(scoped[0].publishedAt).toBeNull();
  expect(
    selectResearchReferences(
      [moment, release],
      { ...request, fromDate: "2026-10-01" },
      "Pete",
      now,
    ).map(r => r.sourceId),
  ).toEqual([moment.sourceId]);
});
it("excludes already-covered originals before picking newest evidence", () => {
  const first = {
    ...original,
    sourceId: "first",
    text: "One project",
    publishedAt: "2026-10-08",
    url: "https://example.com/one",
  };
  const next = {
    ...first,
    sourceId: "next",
    text: "Other project",
    publishedAt: "2026-10-07",
    url: "https://example.com/two",
  };
  const refs = selectResearchReferences(
    [first, next],
    {
      topic: "other updates",
      evidenceNeed: "reporting",
      freshness: "stored",
      retrieval: "latest",
      excludeSourceUrls: [first.url],
    },
    "Artist",
    Date.parse("2026-10-09"),
  );
  expect(refs.map(r => r.sourceId)).toEqual(["next"]);
});
