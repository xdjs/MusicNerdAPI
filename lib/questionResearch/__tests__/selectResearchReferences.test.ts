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
