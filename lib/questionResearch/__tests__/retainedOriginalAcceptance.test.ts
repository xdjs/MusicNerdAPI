import { expect, it } from "vitest";
import { getEligibleResearchOriginals } from "../getEligibleResearchOriginals";
import type { ResearchOriginal, ResearchRequest } from "../types";

// Synthetic acceptance fixtures exercise retained-evidence boundaries only.
// They do not evaluate a model's interpretation or constitute blind/live QA.
const request: ResearchRequest = {
  topic: "Harbor EP recording credits",
  evidenceNeed: "credits",
  freshness: "stored",
};
const original: ResearchOriginal = {
  sourceId: "fixture:original",
  revision: "a".repeat(64),
  text: "Mira proposed drums, but they were not used on the final recording.",
  url: "https://artist.example/harbor/original",
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "not_applicable",
  publishedAt: "2026-10-12T12:00:00Z",
  retrievedAt: "2026-10-18T12:00:00Z",
  truncated: false,
};

it("retains conflicting and qualified originals instead of collapsing them into one assertion", () => {
  const conflict = {
    ...original,
    sourceId: "fixture:conflict",
    revision: "b".repeat(64),
    text: "An early announcement credited Mira with drums on Harbor.",
  };
  const expected = structuredClone([original, conflict]);
  const result = getEligibleResearchOriginals([original, conflict], request);
  expect(result).toEqual(expected);
  expect(result[0].text).toContain("not used");
  expect(result[1].text).toContain("early announcement");
});

it("keeps an exact edition constraint from substituting another edition's affirmative credit", () => {
  const reissue = {
    ...original,
    sourceId: "fixture:reissue",
    url: "https://artist.example/harbor/2026-reissue",
    text: "Mira performed drums on the 2026 reissue bonus track.",
  };
  const expected = structuredClone([original]);
  expect(
    getEligibleResearchOriginals([reissue, original], { ...request, targetUrl: original.url }),
  ).toEqual(expected);
});

it("does not use written caption text as speech or infer the transcript speaker's identity", () => {
  const caption: ResearchOriginal = {
    ...original,
    sourceId: "fixture:caption",
    evidenceKind: "caption",
    url: "https://instagram.com/reel/FIXTURE/",
  };
  const transcript: ResearchOriginal = {
    ...caption,
    sourceId: "fixture:transcript",
    evidenceKind: "provider_transcript",
    speaker: "unverified",
    text: "We tried a different rhythm on that early demo.",
  };
  const expected = structuredClone([transcript]);
  const result = getEligibleResearchOriginals([caption, transcript], {
    ...request,
    evidenceNeed: "spoken_content",
  });
  expect(result).toEqual(expected);
  expect(result[0].speaker).toBe("unverified");
});

it("preserves release and publication dates separately without treating retrieval time as activity", () => {
  const release: ResearchOriginal = {
    ...original,
    activityDate: "2025-08-08",
    activityDateKind: "release",
  };
  const undated = {
    ...original,
    sourceId: "fixture:undated",
    url: "https://artist.example/undated",
    publishedAt: null,
  };
  const expected = structuredClone([release]);
  const result = getEligibleResearchOriginals(
    [release, undated],
    {
      ...request,
      retrieval: "latest",
      evidenceNeed: "release_date",
    },
    Date.parse("2026-10-18T13:00:00Z"),
  );
  expect(result).toEqual(expected);
  expect(result[0]).toMatchObject({
    activityDate: "2025-08-08",
    activityDateKind: "release",
    publishedAt: "2026-10-12T12:00:00Z",
    retrievedAt: "2026-10-18T12:00:00Z",
  });
});
