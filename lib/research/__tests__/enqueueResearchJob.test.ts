import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const txExecute = vi.fn();
const guard = vi.fn();
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: (...a: unknown[]) => guard(...a),
}));
const { enqueueResearchJob } = await import("@/lib/research/enqueueResearchJob");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  txExecute.mockReset();
  guard.mockReset().mockImplementation(async (_a, _j, write) => write({ execute: txExecute }));
});

describe("enqueueResearchJob", () => {
  it("inserts under the parent job's guard, idempotently", async () => {
    expect(
      await enqueueResearchJob("artist-1", "caption_extract", {
        parentJobId: "parent",
        state: { incremental: true },
      }),
    ).toBe(true);
    expect(guard.mock.calls[0].slice(0, 2)).toEqual(["artist-1", "parent"]);
    const { text, params } = renderSql(txExecute.mock.calls[0][0]);
    expect(text).toContain("insert into artist_research_jobs (artist_id, kind, total, state)");
    expect(text).toContain("on conflict do nothing");
    expect(params).toEqual(["artist-1", "caption_extract", null, '{"incremental":true}']);
  });

  it("rethrows a revoked claim and reports other failures as false", async () => {
    guard.mockRejectedValueOnce(new OwnershipChangedError());
    await expect(
      enqueueResearchJob("a", "caption_extract", { parentJobId: "p" }),
    ).rejects.toBeInstanceOf(OwnershipChangedError);
    guard.mockRejectedValueOnce(new Error("pool"));
    expect(await enqueueResearchJob("a", "caption_extract", { parentJobId: "p" })).toBe(false);
  });
});
