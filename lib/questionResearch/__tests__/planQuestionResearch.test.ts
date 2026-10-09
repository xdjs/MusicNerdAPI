import { describe, it, expect } from "vitest";
import { planQuestionResearch } from "@/lib/questionResearch/planQuestionResearch";
const artist = { name: "Example Artist", instagram: "example", tiktok: "example", x: "example" };
const base = {
  topic: "DAY 002 production credits",
  evidenceNeed: "credits" as const,
  freshness: "stored" as const,
};
describe("planQuestionResearch", () => {
  it("uses original release and credit pages rather than claiming structured database adapters", () => {
    expect(planQuestionResearch(base, artist)).toMatchObject({
      provider: "web",
      stage: "searching",
    });
    expect(planQuestionResearch(base, artist)).toHaveProperty(
      "query",
      '"Example Artist" DAY 002 production credits credits liner notes official release',
    );
  });
  it("routes an exact connected TikTok post without downloading audio", () => {
    expect(
      planQuestionResearch(
        { ...base, targetUrl: "https://www.tiktok.com/@example/video/123" },
        artist,
      ),
    ).toMatchObject({
      provider: "tiktok",
      handle: "example",
      targetUrl: "https://www.tiktok.com/@example/video/123",
      limit: 1,
    });
  });
  it("does not pay to collect a foreign account", () => {
    expect(
      planQuestionResearch({ ...base, targetUrl: "https://x.com/other/status/123" }, artist),
    ).toMatchObject({ stage: "unresolved", reason: "account_mismatch" });
  });
  it("does not confuse caption support with unsupported speech", () => {
    expect(
      planQuestionResearch(
        {
          ...base,
          evidenceNeed: "spoken_content",
          targetUrl: "https://www.tiktok.com/@example/video/123",
        },
        artist,
      ),
    ).toMatchObject({ stage: "unresolved", reason: "unsupported_speech" });
  });
  it("requests one exact IG reel transcript, with ownership checked again on collection", () => {
    expect(
      planQuestionResearch(
        {
          ...base,
          evidenceNeed: "spoken_content",
          targetUrl: "https://www.instagram.com/reel/ABC/",
        },
        artist,
      ),
    ).toMatchObject({ provider: "instagram_reels", stage: "transcribing", limit: 1 });
  });
  it("requires an explicit reel rather than guessing which video to transcribe", () => {
    expect(
      planQuestionResearch(
        { ...base, evidenceNeed: "spoken_content", platform: "instagram" },
        artist,
      ),
    ).toMatchObject({ stage: "unresolved", reason: "specific_post_required" });
  });
  it("bounds connected account scans and does not invent IG full-text search", () => {
    expect(
      planQuestionResearch(
        { ...base, evidenceNeed: "social_caption", platform: "instagram" },
        artist,
      ),
    ).toMatchObject({ provider: "instagram", limit: 20, handle: "example" });
  });
  it("will not route credentials or internal addresses to a provider", () => {
    for (const targetUrl of [
      "http://127.0.0.1/",
      "https://user:pass@example.com/",
      "https://localhost/",
      "https://example.com:8080/",
    ])
      expect(() => planQuestionResearch({ ...base, targetUrl }, artist)).toThrow();
  });
});

it("does not use a platform hint to treat a web page as spoken content", () => {
  expect(
    planQuestionResearch(
      {
        ...base,
        evidenceNeed: "spoken_content",
        platform: "instagram",
        targetUrl: "https://example.com/article",
      },
      artist,
    ),
  ).toMatchObject({ stage: "unresolved", reason: "unsupported_speech" });
});

it("routes an unscoped latest overview to a connected social account after saved evidence is insufficient", () => {
  const request = {
    topic: "latest updates",
    evidenceNeed: "reporting",
    freshness: "stored",
    retrieval: "latest",
  } as const;
  expect(planQuestionResearch(request, { name: "Artist", instagram: "artist" })).toMatchObject({
    provider: "instagram",
    handle: "artist",
    limit: 20,
  });
  expect(planQuestionResearch(request, { name: "Artist", tiktok: "artist" })).toMatchObject({
    provider: "tiktok",
  });
  expect(
    planQuestionResearch(
      { ...request, evidenceNeed: "credits" },
      { name: "Artist", instagram: "artist" },
    ),
  ).toMatchObject({ provider: "web", reason: "work_specific_originals" });
  expect(
    planQuestionResearch(
      { ...request, targetUrl: "https://artist.example/news" },
      { name: "Artist", instagram: "artist" },
    ),
  ).toMatchObject({ provider: "page" });
});

it.each(["inprocess", "spotify", "deezer"] as const)(
  "does not fall back from explicit %s to TikTok",
  platform => {
    const connections = {
      inprocess: "0x" + "a".repeat(40),
      spotify: "a".repeat(22),
      deezer: "123",
      tiktok: "example",
    };
    expect(
      planQuestionResearch(
        { ...base, retrieval: "latest", platform },
        { ...artist, ...connections },
      ),
    ).toMatchObject({ provider: null, reason: "provider_latest_refresh_required" });
    expect(planQuestionResearch({ ...base, retrieval: "latest", platform }, artist)).toMatchObject({
      provider: null,
      reason: "connected_account_required",
    });
  },
);
it("refuses a conflicting explicit source and URL", () => {
  expect(
    planQuestionResearch(
      { ...base, platform: "inprocess", targetUrl: "https://www.tiktok.com/@example/video/123" },
      artist,
    ),
  ).toMatchObject({ provider: null, reason: "source_platform_mismatch" });
});
