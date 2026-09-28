import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkInstagramScrape } from "@/lib/instagram/checkInstagramScrape";

const fetchMock = vi.fn();
const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("APIFY_API_TOKEN", "tok");
});

describe("checkInstagramScrape", () => {
  it("maps Apify's run states", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ data: { status: "SUCCEEDED", defaultDatasetId: "ds" } }),
    );
    expect(await checkInstagramScrape("run")).toEqual({
      status: "ready",
      runId: "run",
      datasetId: "ds",
    });
    fetchMock.mockResolvedValueOnce(json({ data: { status: "RUNNING" } }));
    expect(await checkInstagramScrape("run")).toEqual({ status: "running", runId: "run" });
    fetchMock.mockResolvedValueOnce(json({ data: { status: "ABORTED" } }));
    expect(await checkInstagramScrape("run")).toEqual({
      status: "failed",
      reason: "apify run ABORTED",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.apify.com/v2/actor-runs/run?token=tok");
  });

  it("fails on a bad status or a thrown fetch", async () => {
    fetchMock.mockResolvedValueOnce(json({}, false, 404));
    expect(await checkInstagramScrape("run")).toEqual({
      status: "failed",
      reason: "apify status 404",
    });
    fetchMock.mockRejectedValueOnce(new Error("reset"));
    expect(await checkInstagramScrape("run")).toEqual({ status: "failed", reason: "reset" });
  });
});
