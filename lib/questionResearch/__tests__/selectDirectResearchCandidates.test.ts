import { describe, expect, it } from "vitest";
import { selectDirectResearchCandidates } from "../selectDirectResearchCandidates";
import type { ResearchOriginal, ResearchRequest } from "../types";
const now = Date.parse("2026-10-15T12:00:00Z");
const request: ResearchRequest = {
  topic: "Recent artist activity",
  evidenceNeed: "reporting",
  freshness: "stored",
  retrieval: "latest",
  answerScope: "overview",
};
const original = (id: string, overrides: Partial<ResearchOriginal> = {}): ResearchOriginal => ({
  sourceId: id,
  revision: "a".repeat(64),
  text: "A concrete music update. ".repeat(200),
  url: `https://www.instagram.com/p/${id}/`,
  curation: "approved",
  evidenceKind: "caption",
  speaker: "not_applicable",
  publishedAt: "2026-10-14T12:00:00Z",
  retrievedAt: null,
  truncated: false,
  ...overrides,
});
const moment = (
  id: number,
  date: string,
  overrides: Partial<ResearchOriginal> = {},
): ResearchOriginal =>
  original(`latest:inprocess:${id.toString(16).padStart(64, "0")}`, {
    url: `https://www.inprocess.world/collect/base:0x${"b".repeat(40)}/${id}`,
    activityDate: date,
    activityDateKind: "moment",
    publishedAt: null,
    evidenceKind: "original_text",
    text: JSON.stringify({
      provider: "inprocess",
      timeline_account: `0x${"a".repeat(40)}`,
      collection_name: "An archive",
      description: `Moment ${id}`,
    }),
    ...overrides,
  });
const followup: ResearchRequest = {
  ...request,
  excludeSourceUrls: ["https://www.inprocess.world/collect/base:0x" + "b".repeat(40) + "/100"],
};
describe("direct saved candidates", () => {
  it("interleaves latest providers without allowing one busy account to crowd out others", () => {
    const instagram = Array.from({ length: 8 }, (_, i) =>
      original(`ig-${i}`, { publishedAt: `2026-10-${String(14 - i).padStart(2, "0")}T12:00:00Z` }),
    );
    const other = original("other", {
      url: "https://inprocess.world/moment/other",
      publishedAt: "2026-10-10T12:00:00Z",
    });
    const result = selectDirectResearchCandidates([...instagram, other], request, "Artist", now);
    expect(result.selection).toBe("candidates");
    expect(result.references.map(r => r.sourceId)).toEqual([
      "ig-0",
      "other",
      "ig-1",
      "ig-2",
      "ig-3",
      "ig-4",
    ]);
    expect(result.coverage).toEqual({
      eligibleSources: 9,
      returnedSources: 6,
      returnedChars: 12000,
      exhaustive: false,
    });
    expect(result).not.toHaveProperty("sufficient");
    expect(result).not.toHaveProperty("jobId");
  });
  it("applies platform, canonical excluded URL and explicit date scope before the bounded selection", () => {
    const sources = [
      original("excluded"),
      original("kept", { publishedAt: "2026-10-13" }),
      original("old", { publishedAt: "2026-10-01" }),
      original("other", { url: "https://www.tiktok.com/@artist/video/123" }),
      original("future", { publishedAt: "2026-10-16" }),
      original("unknown", { publishedAt: null }),
    ];
    const result = selectDirectResearchCandidates(
      sources,
      {
        ...request,
        platform: "instagram",
        fromDate: "2026-10-10",
        excludeSourceUrls: ["https://instagram.com/p/excluded"],
      },
      "Artist",
      now,
    );
    expect(result.references.map(r => r.sourceId)).toEqual(["kept"]);
  });
  it("retains release-date priority and focused three-window limits", () => {
    const release = original("release", {
      url: "https://open.spotify.com/album/one",
      activityDate: "2026-10-01",
      activityDateKind: "release",
    });
    const result = selectDirectResearchCandidates(
      [original("newer-post"), release],
      { ...request, evidenceNeed: "release_date" },
      "Artist",
      now,
    );
    expect(result.references.map(r => r.sourceId)).toEqual(["release"]);
    expect(result.references[0].activityDateKind).toBe("release");
  });
  it("preserves exact original offsets and UTF-16 text in focused relevance windows", () => {
    const source = original("vault", {
      url: "https://example.org/interview",
      evidenceKind: "original_text",
      text:
        "Introduction. ".repeat(50) +
        "Graphic design started because I needed flyers. " +
        "More context. ".repeat(100),
    });
    const result = selectDirectResearchCandidates(
      [source],
      { topic: "why graphic design flyers", evidenceNeed: "reporting", freshness: "stored" },
      "Artist",
      now,
    );
    expect(result.references.length).toBeGreaterThan(0);
    for (const ref of result.references)
      expect(ref.text).toBe(source.text.slice(ref.start, ref.end));
    expect(result.coverage.returnedChars).toBeLessThanOrEqual(12000);
    expect(result.coverage.exhaustive).toBe(false);
  });
  it("does not substitute a matching caption for requested speech, or widen a target URL", () => {
    const target = original("target", { text: "Filmed by Correct Person" });
    const transcript = original("transcript", {
      url: target.url,
      evidenceKind: "provider_transcript",
      speaker: "unverified",
      text: "Some unrelated spoken words",
    });
    const result = selectDirectResearchCandidates(
      [target, transcript, original("other")],
      {
        topic: "who filmed this",
        evidenceNeed: "spoken_content",
        freshness: "stored",
        targetUrl: target.url,
      },
      "Artist",
      now,
    );
    expect(result.references.map(r => r.sourceId)).toEqual(["transcript"]);
    expect(result.references[0].speaker).toBe("unverified");
  });
  it("returns empty candidates without claiming that evidence does not exist", () => {
    const result = selectDirectResearchCandidates([], request, "Artist", now);
    expect(result).toEqual({
      selection: "candidates",
      references: [],
      coverage: { eligibleSources: 0, returnedSources: 0, returnedChars: 0, exhaustive: false },
    });
  });
  it("keeps old provider families outside the newest six distinct reporting posts", () => {
    const recent = Array.from({ length: 8 }, (_, i) =>
      original(`recent-${i}`, { publishedAt: `2026-10-${String(14 - i).padStart(2, "0")}` }),
    );
    const old = original("old-article", {
      url: "https://magazine.example/interview",
      evidenceKind: "original_text",
      publishedAt: "2021-09-07",
    });
    const result = selectDirectResearchCandidates([...recent, old], request, "Artist", now);
    expect(result.references.map(r => r.sourceId)).toEqual(recent.slice(0, 6).map(r => r.sourceId));
  });
  it("counts a caption and transcript as one latest post and prefers its written evidence", () => {
    const posts = Array.from({ length: 6 }, (_, i) =>
      original(`post-${i}`, { publishedAt: `2026-10-${String(14 - i).padStart(2, "0")}` }),
    );
    const transcript = {
      ...posts[0],
      sourceId: "new-transcript",
      evidenceKind: "provider_transcript" as const,
      speaker: "unverified" as const,
    };
    const result = selectDirectResearchCandidates([transcript, ...posts], request, "Artist", now);
    expect(result.references.map(r => r.sourceId)).toEqual(posts.map(r => r.sourceId));
    expect(result.references.some(r => r.evidenceKind === "provider_transcript")).toBe(false);
  });
  it("offers distinct recent activities for a follow-up without excluding the previous collection", () => {
    const archive = Array.from({ length: 8 }, (_, i) =>
      moment(i + 1, `2026-10-${String(14 - i).padStart(2, "0")}`),
    );
    const other = moment(20, "2026-10-02", {
      url: `https://www.inprocess.world/collect/base:0x${"c".repeat(40)}/20`,
    });
    const recoveredTape = original("tape", { publishedAt: "2026-09-30" });
    const houseFlip = original("flip", { publishedAt: "2026-09-22" });
    const oldArticle = original("old", {
      url: "https://magazine.example/interview",
      publishedAt: "2021-01-01",
    });
    const morePosts = [
      original("next", { publishedAt: "2026-09-20" }),
      original("next2", { publishedAt: "2026-09-18" }),
      original("next3", { publishedAt: "2026-09-16" }),
    ];
    const result = selectDirectResearchCandidates(
      [...archive, other, recoveredTape, houseFlip, ...morePosts, oldArticle],
      followup,
      "Artist",
      now,
    );
    expect(result.references.map(r => r.sourceId)).toEqual([
      archive[0].sourceId,
      recoveredTape.sourceId,
      other.sourceId,
      houseFlip.sourceId,
      "next",
      "next2",
    ]);
    expect(
      result.references.filter(r => archive.some(a => a.sourceId === r.sourceId)),
    ).toHaveLength(1);
    for (const ref of result.references) {
      const source = [...archive, other, recoveredTape, houseFlip, ...morePosts, oldArticle].find(
        o => o.sourceId === ref.sourceId,
      )!;
      expect(ref.text).toBe(source.text.slice(ref.start, ref.end));
    }
    expect(result.coverage.returnedChars).toBeLessThanOrEqual(12000);
    expect(result.coverage.exhaustive).toBe(false);
  });
  it("preserves individual posts for a first overview, focused question and explicit target", () => {
    const archive = Array.from({ length: 8 }, (_, i) =>
      moment(i + 1, `2026-10-${String(14 - i).padStart(2, "0")}`),
    );
    expect(
      selectDirectResearchCandidates(archive, request, "Artist", now).references.map(
        r => r.sourceId,
      ),
    ).toEqual(archive.slice(0, 6).map(r => r.sourceId));
    expect(
      selectDirectResearchCandidates(
        archive,
        { ...followup, answerScope: "focused" },
        "Artist",
        now,
      ).references.map(r => r.sourceId),
    ).toEqual(archive.slice(0, 3).map(r => r.sourceId));
    expect(
      selectDirectResearchCandidates(
        archive,
        { ...followup, targetUrl: archive[2].url },
        "Artist",
        now,
      ).references.map(r => r.sourceId),
    ).toEqual([archive[2].sourceId]);
  });
  it("uses stable collection and account identity, not collection names, for grouping", () => {
    const first = moment(1, "2026-10-14");
    const same = moment(2, "2026-10-13", {
      text: JSON.stringify({
        provider: "inprocess",
        timeline_account: `0x${"a".repeat(40)}`,
        collection_name: "Renamed",
      }),
    });
    const distinctCollection = moment(3, "2026-10-12", {
      url: `https://www.inprocess.world/collect/base:0x${"c".repeat(40)}/3`,
    });
    const distinctAccount = moment(4, "2026-10-11", {
      text: JSON.stringify({
        provider: "inprocess",
        timeline_account: `0x${"d".repeat(40)}`,
        collection_name: "An archive",
      }),
    });
    const result = selectDirectResearchCandidates(
      [first, same, distinctCollection, distinctAccount],
      followup,
      "Artist",
      now,
    );
    expect(result.references.map(r => r.sourceId)).toEqual([
      first.sourceId,
      distinctCollection.sourceId,
      distinctAccount.sourceId,
    ]);
  });
  it("does not group malformed metadata, untrusted source types or profile URL fallbacks", () => {
    const sources = [
      moment(6, "2026-10-15"),
      moment(1, "2026-10-14", { text: "not json" }),
      moment(2, "2026-10-13", {
        text: JSON.stringify({
          provider: "inprocess",
          timeline_account: 42,
          collection_name: "An archive",
        }),
      }),
      moment(3, "2026-10-12", { sourceId: "vault:article" }),
      moment(4, "2026-10-11", { url: "https://inprocess.world/artist-one" }),
      moment(5, "2026-10-10", {
        url: "https://unrelated.example/collect/base:0x" + "b".repeat(40) + "/5",
      }),
    ];
    expect(
      selectDirectResearchCandidates(sources, followup, "Artist", now).references,
    ).toHaveLength(6);
  });
  it("keeps date/platform/excluded-URL boundaries before follow-up collection grouping", () => {
    const excluded = moment(100, "2026-10-14");
    const kept = moment(2, "2026-10-13");
    const older = moment(3, "2026-09-30", {
      url: `https://www.inprocess.world/collect/base:0x${"c".repeat(40)}/3`,
    });
    const other = original("ig");
    const result = selectDirectResearchCandidates(
      [excluded, kept, older, other],
      { ...followup, platform: "inprocess", fromDate: "2026-10-01", toDate: "2026-10-13" },
      "Artist",
      now,
    );
    expect(result.references.map(r => r.sourceId)).toEqual([kept.sourceId]);
  });
});
