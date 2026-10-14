import { expect, it } from "vitest";
import { getEligibleResearchOriginals } from "../getEligibleResearchOriginals";
import type { ResearchOriginal } from "../types";

it("keeps newer artist release announcements available alongside older catalog records", () => {
  const base = {
    revision: "r1",
    text: "Release details",
    retrievedAt: null,
    curation: "approved",
    speaker: "not_applicable",
    truncated: false,
  } as const;
  const originals: ResearchOriginal[] = [
    {
      ...base,
      sourceId: "catalog",
      url: "https://open.spotify.com/album/old",
      evidenceKind: "original_text",
      publishedAt: null,
      activityDate: "2025-08-08",
      activityDateKind: "release",
    },
    {
      ...base,
      sourceId: "announcement",
      url: "https://instagram.com/p/new",
      evidenceKind: "caption",
      publishedAt: "2026-10-09T12:00:00Z",
    },
  ];
  const result = getEligibleResearchOriginals(
    originals,
    {
      topic: "Latest release",
      freshness: "stored",
      retrieval: "latest",
      answerScope: "focused",
      evidenceNeed: "release_date",
    },
    Date.parse("2026-10-14T00:00:00Z"),
  );
  expect(result.map(s => s.sourceId).sort()).toEqual(["announcement", "catalog"]);
});
