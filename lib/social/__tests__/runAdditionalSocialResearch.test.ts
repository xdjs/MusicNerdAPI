import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  plan: vi.fn(),
  start: vi.fn(),
  check: vi.fn(),
  collect: vi.fn(),
  save: vi.fn(),
  connected: vi.fn(),
}));
vi.mock("@/lib/social/socialTaskIsConnected", () => ({ socialTaskIsConnected: m.connected }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: async (_a: string, _j: string, fn: (writer: object) => Promise<unknown>) =>
    fn({}),
}));
vi.mock("@/lib/social/planSocialResearch", () => ({ planSocialResearch: m.plan }));
vi.mock("@/lib/social/startSocialScrape", () => ({ startSocialScrape: m.start }));
vi.mock("@/lib/instagram/checkInstagramScrape", () => ({ checkInstagramScrape: m.check }));
vi.mock("@/lib/social/collectSocialScrape", () => ({ collectSocialScrape: m.collect }));
vi.mock("@/lib/social/persistSocialResearch", () => ({ persistSocialResearch: m.save }));
const { runAdditionalSocialResearch } = await import("@/lib/social/runAdditionalSocialResearch");
const job = (tasks?: unknown[]) => ({
  id: "j",
  artistId: "a",
  kind: "social_ingest" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 0,
  state: tasks ? { instagramFinished: true, additionalSocial: { tasks, index: 0 } } : {},
  activityId: null,
  updatedAt: null,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.plan.mockResolvedValue([]);
  m.connected.mockResolvedValue(true);
});
describe("additional durable social stages", () => {
  it("does not scrape a disconnected or changed identity", async () => {
    m.connected.mockResolvedValue(false);
    await runAdditionalSocialResearch(
      job([{ source: "x", handle: "artist" }]),
      Date.now() + 55_000,
    );
    expect(m.start).not.toHaveBeenCalled();
    expect(m.save.mock.calls[0][0].state.additionalSocial.tasks[0]).toMatchObject({
      status: "failed",
      failure: "social profile changed or disconnected",
    });
  });
  it("starts once and saves the provider id and Instagram completion before waiting", async () => {
    m.plan.mockResolvedValue([{ source: "tiktok", handle: "artist" }]);
    m.start.mockResolvedValue({ status: "started", runId: "paid" });
    expect(await runAdditionalSocialResearch(job(), Date.now() + 55_000)).toMatchObject({
      waiting: true,
      done: false,
    });
    expect(m.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "j",
        state: {
          instagramFinished: true,
          additionalSocial: {
            tasks: [{ source: "tiktok", handle: "artist", startRequested: true, runId: "paid" }],
            index: 0,
          },
        },
      }),
      true,
    );
  });
  it("retries transient status reads using the original paid run", async () => {
    m.check.mockResolvedValue({ status: "failed", reason: "apify status 429", retryable: true });
    await runAdditionalSocialResearch(
      job([{ source: "x", handle: "artist", runId: "paid" }]),
      Date.now() + 55_000,
    );
    expect(m.start).not.toHaveBeenCalled();
    expect(m.save.mock.calls[0][0].state.additionalSocial.tasks[0]).toMatchObject({
      runId: "paid",
      attempts: 1,
    });
  });
  it("holds a saved dataset across collection failures", async () => {
    m.collect.mockResolvedValue(null);
    await runAdditionalSocialResearch(
      job([{ source: "x", handle: "artist", runId: "paid", datasetId: "ds" }]),
      Date.now() + 55_000,
    );
    expect(m.check).not.toHaveBeenCalled();
    expect(m.start).not.toHaveBeenCalled();
    expect(m.save.mock.calls[0][0].state.additionalSocial.tasks[0]).toMatchObject({
      datasetId: "ds",
      attempts: 1,
    });
  });
  it("records terminal failure and lets the next source proceed", async () => {
    m.check.mockResolvedValue({ status: "failed", reason: "apify run FAILED" });
    await runAdditionalSocialResearch(
      job([
        { source: "x", handle: "artist", runId: "paid" },
        { source: "reels", handle: "artist", reels: [] },
      ]),
      Date.now() + 55_000,
    );
    expect(m.save.mock.calls[0][0].state.additionalSocial).toMatchObject({
      index: 1,
      tasks: [{ status: "failed", failure: "apify run FAILED" }, {}],
    });
  });
  it("does no work when the invocation budget is too short", async () => {
    expect(
      await runAdditionalSocialResearch(
        job([{ source: "x", handle: "artist" }]),
        Date.now() + 1000,
      ),
    ).toMatchObject({ waiting: true });
    expect(m.start).not.toHaveBeenCalled();
  });
  it("returns null when every task was collected, allowing one extraction handoff", async () => {
    m.collect.mockResolvedValue(3);
    expect(
      await runAdditionalSocialResearch(
        job([{ source: "tiktok", handle: "artist", runId: "paid", datasetId: "ds" }]),
        Date.now() + 55_000,
      ),
    ).toBeNull();
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ id: "j" }), false);
  });
  it("never repeats a paid start whose outcome was lost", async () => {
    await runAdditionalSocialResearch(
      job([{ source: "x", handle: "artist", startRequested: true }]),
      Date.now() + 55_000,
    );
    expect(m.start).not.toHaveBeenCalled();
    expect(m.save.mock.calls[0][0].state.additionalSocial.tasks[0]).toMatchObject({
      status: "failed",
    });
  });
});
