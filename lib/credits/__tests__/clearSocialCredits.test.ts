import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ where: vi.fn(), withResearchJobWrite: vi.fn() }));
const tx = { delete: () => ({ where: (...a: unknown[]) => m.where(...a) }) };
vi.mock("@/lib/db/db", () => ({ db: tx }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: (...a: unknown[]) => m.withResearchJobWrite(...a),
}));
const { clearSocialCredits } = await import("@/lib/credits/clearSocialCredits");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

beforeEach(() => {
  m.where.mockReset().mockResolvedValue([]);
  m.withResearchJobWrite
    .mockReset()
    .mockImplementation(async (_a: string, _j: string, write: (t: typeof tx) => Promise<unknown>) =>
      write(tx),
    );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("clearSocialCredits", () => {
  it("deletes under the job's write guard when a job is given", async () => {
    await clearSocialCredits("a1", "job-1");
    expect(m.withResearchJobWrite).toHaveBeenCalledWith("a1", "job-1", expect.any(Function));
    expect(m.where).toHaveBeenCalledTimes(1);
  });

  it("deletes directly without a job, and does nothing without an artist", async () => {
    await clearSocialCredits("a1");
    expect(m.withResearchJobWrite).not.toHaveBeenCalled();
    expect(m.where).toHaveBeenCalledTimes(1);
    await clearSocialCredits("");
    expect(m.where).toHaveBeenCalledTimes(1);
  });

  it("rethrows a cancellation and swallows any other error", async () => {
    m.withResearchJobWrite.mockImplementationOnce(async () => {
      throw new OwnershipChangedError();
    });
    await expect(clearSocialCredits("a1", "job-1")).rejects.toBeInstanceOf(OwnershipChangedError);
    m.where.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    await expect(clearSocialCredits("a1")).resolves.toBeUndefined();
  });
});
