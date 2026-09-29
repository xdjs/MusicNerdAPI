import { describe, it, expect, vi, beforeEach } from "vitest";
import { startInstagramScrape } from "@/lib/instagram/startInstagramScrape";

const fetchMock = vi.fn();
const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("APIFY_API_TOKEN", "tok");
});

describe("startInstagramScrape", () => {
  it("starts a run for the profile and returns its id without waiting", async () => {
    fetchMock.mockResolvedValue(json({ data: { id: "run-1" } }));
    expect(await startInstagramScrape("@biorritmo")).toEqual({ status: "started", runId: "run-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=tok");
    expect(JSON.parse(init.body)).toEqual({
      directUrls: ["https://www.instagram.com/biorritmo/"],
      resultsType: "posts",
      resultsLimit: 200,
      addParentData: false,
    });
  });

  it("clamps the limit to the hard cap", async () => {
    fetchMock.mockResolvedValue(json({ data: { id: "run-1" } }));
    await startInstagramScrape("x", { limit: 5000 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).resultsLimit).toBe(300);
  });

  it("fails without a token, on a bad status, without an id and when fetch throws", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "");
    expect(await startInstagramScrape("x")).toEqual({ status: "failed", reason: "no apify token" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("APIFY_API_TOKEN", "tok");
    fetchMock.mockResolvedValueOnce(json({}, false, 402));
    expect(await startInstagramScrape("x")).toEqual({
      status: "failed",
      reason: "apify start 402",
    });
    fetchMock.mockResolvedValueOnce(json({ data: {} }));
    expect(await startInstagramScrape("x")).toEqual({
      status: "failed",
      reason: "apify returned no run id",
    });
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await startInstagramScrape("x")).toEqual({ status: "failed", reason: "timeout" });
  });
});
