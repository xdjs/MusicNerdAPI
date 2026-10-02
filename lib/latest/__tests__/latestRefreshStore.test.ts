import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

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

  it.each([undefined, false, true])(
    "preserves failures when saving a slice with done=%s",
    async done => {
      await latestRefreshStore(job, state, done);
      const { text, params } = renderSql(m.execute.mock.calls[0][0]);
      expect(text).toContain("attempts = attempts");
      expect(params).not.toContain(0);
      expect(text).toContain("and kind = 'latest_refresh' and status = 'running'");
    },
  );

  it("resets consecutive failures explicitly after a successful provider poll", async () => {
    await latestRefreshStore(job, state, undefined, true);
    const { text, params } = renderSql(m.execute.mock.calls[0][0]);
    const reset = text.match(/attempts = \$(\d+)/);
    expect(reset).not.toBeNull();
    expect(params[Number(reset![1]) - 1]).toBe(0);
    expect(text).toContain("claimed_at = now()");
  });

  it("throws when the job is no longer running, so a lost write is never swallowed", async () => {
    m.execute.mockResolvedValueOnce([]);
    await expect(latestRefreshStore(job, state)).rejects.toThrow("Latest refresh no longer active");
  });
});
