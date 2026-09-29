import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { txExecute, scoped } = vi.hoisted(() => ({ txExecute: vi.fn(), scoped: vi.fn() }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
const { reopenResearchJob } = await import("@/lib/research/reopenResearchJob");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  txExecute.mockReset().mockResolvedValue([]);
  scoped.mockReset().mockImplementation(async (_a, write) => write({ execute: txExecute }));
});

describe("reopenResearchJob", () => {
  it("deletes the artist's finished jobs of that kind under the scoped write", async () => {
    await reopenResearchJob("a1", "social_ingest");
    expect(scoped.mock.calls[0][0]).toBe("a1");
    const { text, params } = renderSql(txExecute.mock.calls[0][0]);
    expect(text).toBe(
      "delete from artist_research_jobs where artist_id = $1::uuid and kind = $2 and status in ('done', 'failed')",
    );
    expect(params).toEqual(["a1", "social_ingest"]);
  });

  it("rethrows a changed claim and swallows other errors", async () => {
    scoped.mockRejectedValueOnce(new OwnershipChangedError());
    await expect(reopenResearchJob("a1", "caption_extract")).rejects.toBeInstanceOf(
      OwnershipChangedError,
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    scoped.mockRejectedValueOnce(new Error("pool"));
    await expect(reopenResearchJob("a1", "caption_extract")).resolves.toBeUndefined();
    error.mockRestore();
  });
});
