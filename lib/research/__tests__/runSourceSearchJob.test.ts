import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  limit: vi.fn(),
  lock: vi.fn(),
  social: vi.fn(),
  prepare: vi.fn(),
  complete: vi.fn(async () => {}),
  checkpoint: vi.fn(),
  record: vi.fn(),
  saved: vi.fn(),
  save: vi.fn(async () => {}),
  search: vi.fn(async () => [] as unknown[]),
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    transaction: (fn: (tx: unknown) => unknown) => fn({}),
    select: () => ({ from: () => ({ where: () => ({ limit: h.limit }) }) }),
  },
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: h.lock }));
vi.mock("@/lib/research/queueSocialIngest", () => ({ queueSocialIngest: h.social }));
vi.mock("@/lib/directoryPreparation/queueDirectoryPreparation", () => ({
  queueDirectoryPreparation: h.prepare,
}));
vi.mock("@/lib/directoryPreparation/recordDirectoryDiscovery", () => ({
  recordDirectoryDiscovery: h.record,
}));
vi.mock("@/lib/directoryPreparation/hasSavedDirectoryDiscovery", () => ({
  hasSavedDirectoryDiscovery: h.saved,
}));
vi.mock("@/lib/directoryPreparation/completeDirectoryDiscovery", () => ({
  completeDirectoryDiscovery: h.checkpoint,
}));
vi.mock("@/lib/research/completeResearchJob", () => ({ completeResearchJob: h.complete }));
vi.mock("@/lib/research/saveJobProgress", () => ({ saveJobProgress: h.save }));
vi.mock("@/lib/vault/searchAndPopulateVault", () => ({ searchAndPopulateVault: h.search }));
const { runSourceSearchJob } = await import("@/lib/research/runSourceSearchJob");
const { artistOperations } = await import("@/lib/ownership/artistOperations");

const job = {
  id: "job",
  artistId: "a1",
  kind: "source_search" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 0,
  state: { claimId: "claim" },
  updatedAt: null,
  activityId: "event",
};
const event = {
  id: "event",
  artistId: "a1",
  actorKind: "user",
  actorUserId: "approving-admin",
  trigger: "claim_approval",
};

beforeEach(() => {
  h.limit.mockReset().mockResolvedValue([event]);
  h.complete.mockClear();
  h.checkpoint.mockReset().mockResolvedValue(true);
  h.record.mockReset().mockImplementation(async job => ({
    ...job,
    state: { ...job.state, directoryDiscovery: { version: 1, completedAt: Date.now() } },
  }));
  h.saved.mockReset().mockResolvedValue(false);
  h.prepare.mockReset().mockResolvedValue(undefined);
  h.lock.mockReset().mockResolvedValue(undefined);
  h.social.mockReset().mockResolvedValue(true);
  h.save.mockClear();
  h.search.mockReset().mockResolvedValue([]);
});

describe("runSourceSearchJob", () => {
  it("uses narrowly fenced directory authority rather than granting the adder editing rights", async () => {
    h.limit.mockResolvedValue([
      {
        ...event,
        trigger: "directory_add",
        action: "directory_add",
        actorUserId: "ordinary-adder",
      },
    ]);
    let observed: unknown;
    h.search.mockImplementation(async () => {
      observed = artistOperations.getStore();
      return [];
    });
    await runSourceSearchJob(
      {
        ...job,
        state: { claimId: null, purpose: "directory_preparation", creationActivityId: "event" },
      },
      Date.now() + 50_000,
    );
    expect(observed).toMatchObject({
      userId: undefined,
      expectedClaimId: null,
      trigger: "directory_add",
      activityId: "event",
    });
    expect(h.lock).toHaveBeenCalled();
    expect(h.prepare).toHaveBeenCalledWith("a1");
    expect(h.checkpoint).toHaveBeenCalledWith(expect.objectContaining({ id: "job" }));
    expect(h.complete).not.toHaveBeenCalled();
    expect(h.social).toHaveBeenCalledWith("a1", { directoryActivityId: "event" });
  });
  it("refuses a directory job whose purpose or immutable creation event was changed", async () => {
    h.limit.mockResolvedValue([{ ...event, trigger: "directory_add", action: "directory_add" }]);
    await expect(runSourceSearchJob(job, Date.now() + 50_000)).rejects.toThrow(
      "Invalid directory research authorization",
    );
    expect(h.search).not.toHaveBeenCalled();
  });
  it("runs as the approving admin, under the job's claim and event, and completes", async () => {
    let observed: unknown;
    h.search.mockImplementation(async () => {
      observed = artistOperations.getStore();
      return [{ id: "s1" }, { id: "s2" }];
    });
    expect(await runSourceSearchJob(job, Date.now() + 50_000)).toEqual({
      progress: "Source search finished, 2 sources added",
      done: true,
    });
    expect(observed).toEqual({
      artistId: "a1",
      userId: "approving-admin",
      expectedClaimId: "claim",
      trigger: "claim_approval",
      activityId: "event",
      sourceOrigin: "research",
    });
    expect(h.search).toHaveBeenCalledWith("a1", {
      deadline: expect.any(Number),
      requireComplete: true,
    });
    expect(h.complete).toHaveBeenCalledWith("job");
    expect(artistOperations.getStore()).toBeUndefined();
  });

  it("leaves a failed search to the retry policy instead of completing it", async () => {
    h.search.mockImplementationOnce(async () => {
      throw new Error("search provider unavailable");
    });
    await expect(runSourceSearchJob(job, Date.now() + 50_000)).rejects.toThrow(
      "search provider unavailable",
    );
    expect(h.complete).not.toHaveBeenCalled();
  });

  it("doesn't start a search it can't finish in the slice", async () => {
    expect(await runSourceSearchJob(job, Date.now() + 5_000)).toEqual({
      progress: "Waiting for a full research slice",
      done: false,
      waiting: true,
    });
    expect(h.save).toHaveBeenCalledWith("job", 0);
    expect(h.search).not.toHaveBeenCalled();
  });

  it("won't invent an initiator: no event, or one for another artist, fails the job", async () => {
    await expect(
      runSourceSearchJob({ ...job, activityId: null }, Date.now() + 50_000),
    ).rejects.toThrow("initiating event");
    h.limit.mockResolvedValueOnce([{ ...event, artistId: "other" }]);
    await expect(runSourceSearchJob(job, Date.now() + 50_000)).rejects.toThrow(
      "Invalid research attribution",
    );
    expect(h.search).not.toHaveBeenCalled();
  });

  it("finishes a cancelled job when the initiating account was deleted", async () => {
    h.limit.mockResolvedValueOnce([{ ...event, actorUserId: null }]);
    expect(await runSourceSearchJob(job, Date.now() + 50_000)).toEqual({
      progress: "Research cancelled: initiating account was deleted",
      done: true,
    });
    expect(h.complete).toHaveBeenCalledWith("job");
    expect(h.search).not.toHaveBeenCalled();
  });
});

it.each(["social", "private"])(
  "a %s child queue failure retries the handoff with exactly one search",
  async kind => {
    h.limit.mockResolvedValue([
      { ...event, trigger: "directory_add", action: "directory_add", actorUserId: "adder" },
    ]);
    const dir = {
      ...job,
      state: { claimId: null, purpose: "directory_preparation", creationActivityId: "event" },
    };
    if (kind === "social") h.social.mockResolvedValueOnce(false);
    else h.prepare.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(runSourceSearchJob(dir, Date.now() + 50_000)).rejects.toThrow();
    expect(h.record).toHaveBeenCalledOnce();
    expect(h.checkpoint).not.toHaveBeenCalled();
    h.saved.mockResolvedValue(true);
    await runSourceSearchJob(
      {
        ...dir,
        state: { ...dir.state, directoryDiscovery: { version: 1, completedAt: Date.now() } },
      },
      Date.now() + 50_000,
    );
    expect(h.search).toHaveBeenCalledTimes(1);
    expect(h.record).toHaveBeenCalledTimes(1);
    expect(h.social).toHaveBeenLastCalledWith("a1", { directoryActivityId: "event" });
    expect(h.checkpoint).toHaveBeenCalledTimes(1);
  },
);

it("does not repeat paid discovery after another worker takes the lease", async () => {
  h.limit.mockResolvedValue([{ ...event, trigger: "directory_add", action: "directory_add" }]);
  h.saved.mockResolvedValue(null);
  const result = await runSourceSearchJob(
    {
      ...job,
      state: { claimId: null, purpose: "directory_preparation", creationActivityId: "event" },
    },
    Date.now() + 50_000,
  );
  expect(result).toMatchObject({ done: false, waiting: true });
  expect(h.search).not.toHaveBeenCalled();
  expect(h.prepare).not.toHaveBeenCalled();
  expect(h.social).not.toHaveBeenCalled();
  expect(h.checkpoint).not.toHaveBeenCalled();
});
