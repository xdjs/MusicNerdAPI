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

  it("fails when the collection fails", async () => {
    m.collect.mockResolvedValueOnce(null);
    expect(
      await refreshLatestInstagram(job({ runId: "run-1", datasetId: "ds-1" }), later()),
    ).toEqual({ status: "failed" });
  });
});
