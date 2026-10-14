import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = { execute: vi.fn(), query: { artistResearchJobs: { findFirst: vi.fn() } } };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}));
const { withResearchJobWrite } = await import("@/lib/research/withResearchJobWrite");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  tx.execute.mockReset();
  tx.query.artistResearchJobs.findFirst.mockReset();
});

describe("withResearchJobWrite", () => {
  it("locks the artist and writes while the job still exists", async () => {
    tx.query.artistResearchJobs.findFirst.mockResolvedValue({ id: "job" });
    const write = vi.fn(async () => "wrote");
    expect(await withResearchJobWrite("artist", "job", write)).toBe("wrote");
    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(tx);
  });

  it("refuses the write once revocation has deleted the job", async () => {
    tx.query.artistResearchJobs.findFirst.mockResolvedValue(undefined);
    const write = vi.fn();
    await expect(withResearchJobWrite("artist", "job", write)).rejects.toBeInstanceOf(
      OwnershipChangedError,
    );
    expect(write).not.toHaveBeenCalled();
  });
});

it("rejects a directory descendant after any claim begins before its write", async () => {
  tx.query.artistResearchJobs.findFirst.mockResolvedValue({
    id: "job",
    state: { directoryActivityId: "event" },
  });
  tx.execute.mockResolvedValue([]);
  const write = vi.fn();
  await expect(withResearchJobWrite("artist", "job", write)).rejects.toThrow("ownership changed");
  expect(write).not.toHaveBeenCalled();
});
it("keeps directory descendants writable only under original creation scope", async () => {
  tx.query.artistResearchJobs.findFirst.mockResolvedValue({
    id: "job",
    state: { directoryActivityId: "event" },
  });
  tx.execute.mockResolvedValue([{ id: "artist" }]);
  const write = vi.fn(async () => true);
  expect(await withResearchJobWrite("artist", "job", write)).toBe(true);
  expect(tx.execute).toHaveBeenCalledTimes(2);
});
it("refuses resumed work when its exact approved claim no longer exists", async () => {
  tx.query.artistResearchJobs.findFirst.mockResolvedValue({
    id: "job",
    state: { resumedFromDirectoryJobId: "old", claimId: "claim" },
  });
  tx.execute.mockResolvedValue([]);
  const write = vi.fn();
  await expect(withResearchJobWrite("artist", "job", write)).rejects.toThrow("ownership changed");
  expect(write).not.toHaveBeenCalled();
});
