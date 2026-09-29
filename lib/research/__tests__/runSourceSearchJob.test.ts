import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  limit: vi.fn(),
  complete: vi.fn(async () => {}),
  save: vi.fn(async () => {}),
  search: vi.fn(async () => [] as unknown[]),
}));
vi.mock("@/lib/db/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: h.limit }) }) }) },
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
  h.save.mockClear();
  h.search.mockReset().mockResolvedValue([]);
});

describe("runSourceSearchJob", () => {
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
