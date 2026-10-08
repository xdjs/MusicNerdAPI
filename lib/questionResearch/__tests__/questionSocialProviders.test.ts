import { it, expect, vi, afterEach } from "vitest";
import { startQuestionSocialRun } from "@/lib/questionResearch/startQuestionSocialRun";
import { mapQuestionSocialOriginal } from "@/lib/questionResearch/mapQuestionSocialOriginal";
import { collectQuestionSocialOriginals } from "@/lib/questionResearch/collectQuestionSocialOriginals";
const request = {
  topic: "record context",
  evidenceNeed: "social_caption" as const,
  freshness: "stored" as const,
};
const plan = {
  provider: "tiktok" as const,
  stage: "reading" as const,
  handle: "example",
  limit: 1,
  targetUrl: "https://www.tiktok.com/@example/video/123",
  reason: "exact",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("sends only the exact direct post, with provider caps and no paid audio extras", async () => {
  vi.stubEnv("APIFY_API_TOKEN", "test-secret");
  const fetch = vi.fn(async () => Response.json({ data: { id: "run1" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await startQuestionSocialRun(plan, request)).toBe("run1");
  const [url, opts] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("maxTotalChargeUsd=0.5");
  expect(url).not.toContain("test-secret");
  expect(JSON.parse(String(opts.body))).toMatchObject({
    postURLs: [plan.targetUrl],
    resultsPerPage: 1,
    downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
    shouldDownloadVideos: false,
    scrapeRelatedVideos: false,
  });
});
it("returns an ambiguous start failure rather than retrying a paid POST", async () => {
  vi.stubEnv("APIFY_API_TOKEN", "test-secret");
  const fetch = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetch);
  await expect(startQuestionSocialRun(plan, request)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("filters wrong authors, reposts and different post URLs before evidence persistence", () => {
  const item = {
    id: "123",
    authorMeta: { name: "example" },
    webVideoUrl: plan.targetUrl,
    createTimeISO: "2026-10-01T00:00:00Z",
    text: "Original caption",
  };
  expect(mapQuestionSocialOriginal(item, plan, request, "artist", "run1")).toMatchObject({
    text: "Original caption",
    provenance: { kind: "caption", speaker: "not_applicable" },
    identity: "confirmed",
  });
  for (const extra of [
    { isRepost: true },
    { authorMeta: { name: "other" } },
    { id: "456", webVideoUrl: "https://www.tiktok.com/@example/video/456" },
  ])
    expect(
      mapQuestionSocialOriginal({ ...item, ...extra }, plan, request, "artist", "run1"),
    ).toBeNull();
});
it("retains IG transcript provenance without claiming verified speaker identity", () => {
  const reel = {
    provider: "instagram_reels" as const,
    stage: "transcribing" as const,
    handle: "example",
    limit: 1,
    targetUrl: "https://www.instagram.com/reel/ABC/",
    reason: "speech",
  };
  const item = {
    id: "1",
    url: reel.targetUrl,
    ownerUsername: "example",
    timestamp: "2026-10-01",
    caption: "Title suggests a graph",
    transcript: "We keep attention.",
  };
  expect(
    mapQuestionSocialOriginal(
      item,
      reel,
      { ...request, evidenceNeed: "spoken_content" },
      "artist",
      "run1",
    ),
  ).toMatchObject({
    text: "We keep attention.",
    provenance: { kind: "provider_transcript", speaker: "unverified" },
  });
  expect(
    mapQuestionSocialOriginal({ ...item, transcript: null }, reel, request, "artist", "run1"),
  ).toBeNull();
});
it("does not treat a broken dataset as an empty successful search", async () => {
  vi.stubEnv("APIFY_API_TOKEN", "test-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json([{ error: "provider refused" }])),
  );
  await expect(
    collectQuestionSocialOriginals(plan, request, "artist", "run1", "dataset"),
  ).rejects.toThrow("unavailable");
});
