import { describe, expect, it } from "vitest";
import { selectResearchReferences } from "@/lib/questionResearch/selectResearchReferences";
import type { ResearchOriginal, ResearchRequest } from "@/lib/questionResearch/types";

const original = (
  sourceId: string,
  text: string,
  url = `https://artist.example/${sourceId}`,
): ResearchOriginal => ({
  sourceId,
  revision: "a".repeat(64),
  text,
  url,
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "unverified",
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
});

const request = (overrides: Partial<ResearchRequest>): ResearchRequest => ({
  topic: "Artist; musical collaborators; collaboration recommendations",
  evidenceNeed: "credits",
  freshness: "stored",
  ...overrides,
});

describe("typed retrieval supplements", () => {
  it("keeps a distinct credit-bearing original available when the compressed topic ranks generic music-session text first", () => {
    const generic = original(
      "generic-session",
      "A spontaneous music session after testing a new soundbar. Music is a big part of my life.",
    );
    const credit = original(
      "credit-caption",
      "For the single Glass Harbor, produced by Mira Vale featuring Sol Maren and me. Ren Ito sent me drums for Quiet Lanterns.",
    );

    const baseRequest = request({
      topic: "Artist; musical collaborators; notable collaboration recommendations",
      evidenceNeed: "social_caption",
    });
    const baseline = selectResearchReferences([generic, credit], baseRequest, "Artist");
    expect(baseline.map(item => item.sourceId)).not.toContain("credit-caption");

    const selected = selectResearchReferences(
      [generic, credit],
      request({ topic: "Artist; musical collaborators; notable collaboration recommendations" }),
      "Artist",
    );

    expect(selected.map(item => item.sourceId)).toContain("credit-caption");
    expect(selected.length).toBeLessThanOrEqual(4);
    expect(selected.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(12_000);
    for (const item of selected) {
      const source = [generic, credit].find(candidate => candidate.sourceId === item.sourceId)!;
      expect(source.text.slice(item.start, item.end)).toBe(item.text);
    }
  });

  it("adds one comparison-oriented source for evolution questions without artist or project-name rules", () => {
    const generic = original(
      "early-review",
      "The early records used guitar and drums. The artist explored new music.",
    );
    const comparison = original(
      "later-review",
      "On a later album, dense synths and winding guitars create an electronic arrangement that contrasts with the earlier work.",
    );

    const baseline = selectResearchReferences(
      [generic, comparison],
      request({
        topic: "Artist; evolution of musical sound since early records",
        evidenceNeed: "social_caption",
        answerScope: "overview",
      }),
      "Artist",
    );
    expect(baseline.map(item => item.sourceId)).not.toContain("later-review");

    const selected = selectResearchReferences(
      [generic, comparison],
      request({
        topic: "Artist; evolution of musical sound since early records",
        evidenceNeed: "reporting",
        answerScope: "overview",
      }),
      "Artist",
    );

    expect(selected.map(item => item.sourceId)).toContain("later-review");
  });

  it("never lets an intent supplement bypass exact URL, platform, exclusion, or spoken-evidence filters", () => {
    const requested = original(
      "eligible-credit",
      "Produced by Noza with drums by Karavelo.",
      "https://www.instagram.com/p/allowed/",
    );
    const mismatchedUrl = original(
      "other-credit",
      "Produced by Noza with drums by Karavelo.",
      "https://www.instagram.com/p/other/",
    );

    const exactTarget = selectResearchReferences(
      [requested, mismatchedUrl],
      request({
        targetUrl: "https://www.instagram.com/p/allowed/",
        excludeSourceUrls: ["https://www.instagram.com/p/other/"],
      }),
      "Artist",
    );
    expect(exactTarget.map(item => item.sourceId)).toContain("eligible-credit");
    expect(exactTarget.map(item => item.sourceId)).not.toContain("other-credit");

    const captions = [requested, mismatchedUrl].map(item => ({
      ...item,
      evidenceKind: "caption" as const,
    }));
    expect(
      selectResearchReferences(captions, request({ evidenceNeed: "spoken_content" }), "Artist"),
    ).toEqual([]);
  });

  it("does not add a typed supplement to an explicitly negated named-work request", () => {
    const excludedWork = original(
      "excluded-work-credit",
      "Silver Current was produced by a collaborator who also played drums.",
    );
    const selected = selectResearchReferences(
      [excludedWork],
      request({
        topic: "Artist; exclude the Silver Current project from credited collaborators",
      }),
      "Artist",
    );
    const baseline = selectResearchReferences(
      [excludedWork],
      request({
        topic: "Artist; exclude the Silver Current project from credited collaborators",
        evidenceNeed: "social_caption",
      }),
      "Artist",
    );

    expect(selected).toEqual(baseline);
  });
});
