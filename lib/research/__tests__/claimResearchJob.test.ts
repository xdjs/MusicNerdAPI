import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { claimResearchJob } = await import("@/lib/research/claimResearchJob");

const row = {
  id: "job-1",
  artist_id: "artist-1",
  kind: "social_ingest",
  status: "running",
  cursor: 3,
  total: null,
  attempts: 1,
  state: { apifyRunId: "run" },
  updated_at: "2026-09-28T00:00:00Z",
};

beforeEach(() => execute.mockReset());

describe("claimResearchJob", () => {
  it("claims the oldest live job of the given kinds and maps the row", async () => {
    execute.mockResolvedValue([row]);
    const job = await claimResearchJob({ kinds: ["social_ingest"] });
    expect(job).toEqual({
      id: "job-1",
      artistId: "artist-1",
      kind: "social_ingest",
      status: "running",
      cursor: 3,
      total: null,
      attempts: 1,
      state: { apifyRunId: "run" },
      updatedAt: "2026-09-28T00:00:00Z",
      activityId: null,
    });
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("set status = 'running', claimed_at = now()");
    expect(text).toContain("for update skip locked");
    expect(text).toMatch(/and kind in \(\$\d+\)/);
    expect(params).toContain("social_ingest");
  });

  it("scopes to one artist and skips jobs already touched this tick, as parameters", async () => {
    execute.mockResolvedValue([]);
    await claimResearchJob({
      kinds: ["social_ingest"],
      artistId: "artist-1",
      excludeIds: ["a", "b"],
    });
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toMatch(/and artist_id = \$\d+::uuid/);
    expect(text).toMatch(/and id not in \(\$\d+::uuid, \$\d+::uuid\)/);
    expect(params).toEqual(expect.arrayContaining(["artist-1", "a", "b"]));
  });

  it("returns null when nothing is claimable or the query fails", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await claimResearchJob({ kinds: ["social_ingest"] })).toBeNull();
    execute.mockRejectedValueOnce(new Error("pool"));
    expect(await claimResearchJob({ kinds: ["social_ingest"] })).toBeNull();
  });
});
