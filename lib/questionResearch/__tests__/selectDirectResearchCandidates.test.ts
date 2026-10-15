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
});
