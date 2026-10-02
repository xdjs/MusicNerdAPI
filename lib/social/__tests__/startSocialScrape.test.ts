import { afterEach, describe, expect, it, vi } from "vitest";
import { startSocialScrape } from "@/lib/social/startSocialScrape";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("bounded provider inputs", () => {
  it.each(["tiktok", "x", "reels"] as const)(
    "starts %s asynchronously with a spend and item cap",
    async source => {
      vi.stubEnv("APIFY_API_TOKEN", "private-token");
      const request = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ data: { id: "run" } }) });
      vi.stubGlobal("fetch", request);
      expect(
        await startSocialScrape({
          source,
          handle: "artist",
          reels: [{ id: "1", url: "https://www.instagram.com/reel/Abc/", owner: "artist" }],
        }),
      ).toEqual({ status: "started", runId: "run" });
      const [url, init] = request.mock.calls[0];
      expect(url).toContain("maxTotalChargeUsd=");
      expect(url).toContain("maxItems=");
      expect(init.headers.Authorization).toBe("Bearer private-token");
      expect(url).not.toContain("private-token");
      if (source === "reels")
        expect(JSON.parse(init.body)).toMatchObject({
          username: ["https://www.instagram.com/reel/Abc/"],
          includeTranscript: true,
          includeDownloadedVideo: false,
        });
      if (source === "tiktok")
        expect(JSON.parse(init.body)).toMatchObject({
          profiles: ["artist"],
          resultsPerPage: 50,
          shouldDownloadVideos: false,
        });
      if (source === "x")
        expect(JSON.parse(init.body)).toMatchObject({
          searchTerms: ["from:artist -filter:retweets"],
          maxItems: 50,
          sort: "Latest",
        });
    },
  );
  it("sanitizes network failure without echoing token-bearing URLs", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "private-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("secret https://api.apify.com/?token=private-token")),
    );
    expect(await startSocialScrape({ source: "x", handle: "artist" })).toEqual({
      status: "failed",
      reason: "apify start unavailable",
    });
  });
});
