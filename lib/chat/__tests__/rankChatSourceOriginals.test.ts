import { expect, it } from "vitest";
import { rankChatSourceOriginals } from "../rankChatSourceOriginals";
import { originalFixture } from "./originalFixture";
import type { ResearchRequest } from "@/lib/questionResearch/types";
const request: ResearchRequest = {
  topic: "session credits",
  evidenceNeed: "reporting",
  freshness: "stored",
  retrieval: "relevance",
};
it("uses one slot per source even when one original contains many matching windows", () => {
  const rows = [
    originalFixture("a", "https://a.example", "session credits. ".repeat(600)),
    ...Array.from({ length: 9 }, (_, i) =>
      originalFixture(
        `b${i}`,
        `https://b.example/${i}`,
        "session credits for a separate recording.",
      ),
    ),
  ];
  const found = rankChatSourceOriginals(rows, request, "Artist", 8);
  expect(found).toHaveLength(8);
  expect(new Set(found.map(s => s.sourceId)).size).toBe(8);
  for (let i = 0; i < rows.length; i++)
    expect(
      rankChatSourceOriginals([...rows.slice(i), ...rows.slice(0, i)], request, "Artist", 8).map(
        s => s.sourceId,
      ),
    ).toEqual(found.map(s => s.sourceId));
});
it("preserves platform, target, date and spoken-evidence constraints", () => {
  const rows = [
    {
      ...originalFixture("a", "https://instagram.com/p/a", "session credits"),
      publishedAt: "2026-01-01",
    },
    {
      ...originalFixture("b", "https://label.example/b", "session credits"),
      publishedAt: "2026-02-01",
    },
  ];
  expect(
    rankChatSourceOriginals(rows, { ...request, platform: "instagram" }, "Artist", 8).map(
      s => s.sourceId,
    ),
  ).toEqual(["a"]);
  expect(
    rankChatSourceOriginals(rows, { ...request, targetUrl: rows[1].url }, "Artist", 8).map(
      s => s.sourceId,
    ),
  ).toEqual(["b"]);
  expect(
    rankChatSourceOriginals(rows, { ...request, fromDate: "2026-02-01" }, "Artist", 8).map(
      s => s.sourceId,
    ),
  ).toEqual(["b"]);
  expect(
    rankChatSourceOriginals(rows, { ...request, evidenceNeed: "spoken_content" }, "Artist", 8),
  ).toEqual([]);
});
it("deduplicates public copies deterministically while retaining approved preference", () => {
  const a = originalFixture("a", "https://label.example/a", "session credits");
  const b = { ...a, sourceId: "b" };
  const pending = { ...a, sourceId: "0", curation: "pending" as const };
  for (const rows of [
    [a, b, pending],
    [pending, b, a],
  ])
    expect(rankChatSourceOriginals(rows, request, "Artist", 8).map(s => s.sourceId)).toEqual(["a"]);
});
