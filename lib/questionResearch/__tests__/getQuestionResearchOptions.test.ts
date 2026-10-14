import { it, expect } from "vitest";
import { getQuestionResearchOptions } from "../getQuestionResearchOptions";
const request = {
  topic: "other recent activities",
  evidenceNeed: "reporting",
  freshness: "stored",
  retrieval: "latest",
} as const;
it("offers all connected supported lookups instead of imposing an Instagram-first route", () => {
  const options = getQuestionResearchOptions(request, {
    name: "Artist",
    instagram: "artist",
    x: "artistnews",
  });
  expect(options.map(p => p.provider)).toEqual(["web", "instagram", "x"]);
});
it("keeps an explicit source restriction and excludes unavailable accounts", () => {
  expect(
    getQuestionResearchOptions(
      { ...request, platform: "x" },
      { name: "Artist", instagram: "artist", x: "artistnews" },
    ).map(p => p.provider),
  ).toEqual(["x"]);
  expect(
    getQuestionResearchOptions(
      { ...request, platform: "x" },
      { name: "Artist", instagram: "artist" },
    ),
  ).toEqual([]);
});
it("retains an exact original without offering unrelated scraping", () => {
  expect(
    getQuestionResearchOptions(
      { ...request, targetUrl: "https://artist.example/credits" },
      { name: "Artist", instagram: "artist" },
    ).map(p => p.provider),
  ).toEqual(["page"]);
});
