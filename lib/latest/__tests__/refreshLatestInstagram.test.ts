import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ start: vi.fn(), check: vi.fn(), collect: vi.fn(), store: vi.fn() }));
vi.mock("@/lib/instagram/startInstagramScrape", () => ({ startInstagramScrape: m.start }));
vi.mock("@/lib/instagram/checkInstagramScrape", () => ({ checkInstagramScrape: m.check }));
vi.mock("@/lib/instagram/collectInstagramScrape", () => ({ collectInstagramScrape: m.collect }));
vi.mock("@/lib/latest/latestRefreshStore", () => ({ latestRefreshStore: m.store }));
const { refreshLatestInstagram } = await import("@/lib/latest/refreshLatestInstagram");

const job = (extra: Record<string, unknown> = {}, instagram = "@handle") => ({
  id: "job-1",
  artistId: "artist-1",
  kind: "latest_refresh" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 0,
  updatedAt: null,
  activityId: "act-1",
  state: { claimId: "c1", userId: "u1", instagram, sources: {}, ...extra } as Record<
    string,
    unknown
  >,
});
const later = () => Date.now() + 55_000;

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.store.mockResolvedValue(undefined);
  process.env.APIFY_API_TOKEN = "t";
});

describe("refreshLatestInstagram", () => {
  it("is disconnected without a handle", async () => {
    expect(await refreshLatestInstagram(job({}, ""), later())).toEqual({ status: "disconnected" });
  });

  it("saves the intent before the paid start, then the run id", async () => {
    m.start.mockResolvedValueOnce({ status: "started", runId: "run-1" });
    const j = job();
    expect(await refreshLatestInstagram(j, later())).toEqual({ status: "pending" });
    expect(m.store).toHaveBeenCalledTimes(2);
    expect(m.store.mock.invocationCallOrder[0]).toBeLessThan(m.start.mock.invocationCallOrder[0]);
    expect(j.state).toMatchObject({ providerStarted: true, runId: "run-1" });
    expect(m.start).toHaveBeenCalledWith("handle", {
      limit: 9,
      maxTotalChargeUsd: 0.03,
      onlyPostsNewerThan: expect.any(String),
    });
  });

  it("never starts a second run after a lost start response", async () => {
    expect(await refreshLatestInstagram(job({ providerStarted: true }), later())).toEqual({
      status: "failed",
    });
    expect(m.start).not.toHaveBeenCalled();
  });

  it("waits while the run is going", async () => {
    m.check.mockResolvedValueOnce({ status: "running", runId: "run-1" });
    expect(await refreshLatestInstagram(job({ runId: "run-1" }), later())).toEqual({
      status: "pending",
    });
  });

  it("collects only the latest posts once the run is ready", async () => {
    m.check.mockResolvedValueOnce({ status: "ready", runId: "run-1", datasetId: "ds-1" });
    m.collect.mockResolvedValueOnce({ stored: 3 });
    const res = await refreshLatestInstagram(job({ runId: "run-1" }), later());
    expect(res.status).toBe("checked");
    expect(m.collect).toHaveBeenCalledWith("artist-1", "handle", "ds-1", "job-1", 0, {
      latestOnly: true,
    });
  });

  it("retries the saved dataset when collection fails", async () => {
    m.collect.mockResolvedValueOnce(null);
    await expect(
      refreshLatestInstagram(job({ runId: "run-1", datasetId: "ds-1" }), later()),
    ).rejects.toThrow("Instagram collection unavailable");
  });
});

it("recovers the same paid run after a temporary status error", async () => {
  const j = job({ runId: "paid-run", providerStarted: true });
  m.check
    .mockResolvedValueOnce({ status: "failed", reason: "apify status 503", retryable: true })
    .mockResolvedValueOnce({ status: "ready", runId: "paid-run", datasetId: "saved-dataset" });
  m.collect.mockResolvedValueOnce({ ingested: 5 });
  await expect(refreshLatestInstagram(j, later())).rejects.toThrow("apify status 503");
  expect(j.state).toMatchObject({
    instagramFailure: { phase: "status", reason: "apify status 503", at: expect.any(String) },
  });
  expect(m.store).toHaveBeenCalledWith(j, j.state);
  expect(await refreshLatestInstagram(j, later())).toMatchObject({ status: "checked" });
  expect(m.check.mock.calls.map(a => a[0])).toEqual(["paid-run", "paid-run"]);
  expect(m.start).not.toHaveBeenCalled();
});
it("records confirmed terminal failure without retrying or paying again", async () => {
  const j = job({ runId: "paid-run" });
  m.check.mockResolvedValueOnce({ status: "failed", reason: "apify run FAILED" });
  expect(await refreshLatestInstagram(j, later())).toEqual({ status: "failed" });
  expect(j.state).toMatchObject({
    instagramFailure: { phase: "status", reason: "apify run FAILED" },
  });
  expect(m.start).not.toHaveBeenCalled();
});
it("recovers collection from the saved dataset without polling or paying again", async () => {
  const j = job({ runId: "paid-run", datasetId: "saved-dataset" });
  m.collect.mockResolvedValueOnce(null).mockResolvedValueOnce({ ingested: 5 });
  await expect(refreshLatestInstagram(j, later())).rejects.toThrow(
    "Instagram collection unavailable",
  );
  expect(await refreshLatestInstagram(j, later())).toMatchObject({ status: "checked" });
  expect(m.check).not.toHaveBeenCalled();
  expect(m.start).not.toHaveBeenCalled();
});
