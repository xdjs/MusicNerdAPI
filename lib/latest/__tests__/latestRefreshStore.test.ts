import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ write: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({ withResearchJobWrite: m.write }));
const { latestRefreshStore } = await import("@/lib/latest/latestRefreshStore");

const job = { id: "job-1", artistId: "artist-1" } as never;
const state = { claimId: null, userId: "u1", sources: {} } as never;
const sqlText = () => JSON.stringify(m.execute.mock.calls[0][0]);

beforeEach(() => {
  m.write.mockReset().mockImplementation(async (_a, _j, fn) => fn({ execute: m.execute }));
  m.execute.mockReset().mockResolvedValue([{ id: "job-1" }]);
});

describe("latestRefreshStore", () => {
  it("writes under the job's guard", async () => {
    await latestRefreshStore(job, state);
    expect(m.write.mock.calls[0].slice(0, 2)).toEqual(["artist-1", "job-1"]);
    expect(sqlText()).toContain("running");
  });

  it("marks the job done or pending when told", async () => {
    await latestRefreshStore(job, state, true);
    expect(sqlText()).toContain("done");
  });

  it("throws when the job is no longer running, so a lost write is never swallowed", async () => {
    m.execute.mockResolvedValueOnce([]);
    await expect(latestRefreshStore(job, state)).rejects.toThrow("Latest refresh no longer active");
  });
});
