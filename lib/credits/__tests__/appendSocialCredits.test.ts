import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  withResearchJobWrite: vi.fn(),
}));
const tx = {
  insert: () => ({
    values: (...a: unknown[]) => {
      m.values(...a);
      return { onConflictDoNothing: () => m.onConflictDoNothing() };
    },
  }),
};
vi.mock("@/lib/db/db", () => ({ db: tx }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: (...a: unknown[]) => m.withResearchJobWrite(...a),
}));
const { appendSocialCredits } = await import("@/lib/credits/appendSocialCredits");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const extraction = {
  credits: [
    {
      subject: "p3t3rango",
      isHandle: true,
      role: "Mixed by",
      quote: "q",
      url: "u1",
      isSelf: false,
    },
  ],
  statements: [{ quote: "q2", topic: "t", url: "u2" }],
};

beforeEach(() => {
  m.values.mockReset();
  m.onConflictDoNothing.mockReset().mockResolvedValue([]);
  m.withResearchJobWrite
    .mockReset()
    .mockImplementation(async (_a: string, _j: string, write: (t: typeof tx) => Promise<unknown>) =>
      write(tx),
    );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("appendSocialCredits", () => {
  it("inserts every row under the job's guard, ignoring conflicts, and returns the count", async () => {
    expect(
      await appendSocialCredits("a1", extraction, new Map([["u1", "2025-01-01"]]), "job-1"),
    ).toBe(2);
    expect(m.withResearchJobWrite).toHaveBeenCalledWith("a1", "job-1", expect.any(Function));
    expect(m.values.mock.calls[0][0]).toHaveLength(2);
    expect(m.values.mock.calls[0][0][0]).toMatchObject({ sourceUrl: "u1", postedAt: "2025-01-01" });
    expect(m.onConflictDoNothing).toHaveBeenCalled();
  });

  it("writes nothing for an empty extraction, still checking the guard, and nothing without an artist", async () => {
    expect(
      await appendSocialCredits("a1", { credits: [], statements: [] }, undefined, "job-1"),
    ).toBe(0);
    expect(m.withResearchJobWrite).toHaveBeenCalledTimes(1);
    expect(await appendSocialCredits("", extraction)).toBe(0);
    expect(m.values).not.toHaveBeenCalled();
  });

  it("is null when the write failed, which is not the same as nothing to write", async () => {
    m.onConflictDoNothing.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await appendSocialCredits("a1", extraction)).toBeNull();
  });

  it("rethrows a cancellation", async () => {
    m.withResearchJobWrite.mockImplementationOnce(async () => {
      throw new OwnershipChangedError();
    });
    await expect(appendSocialCredits("a1", extraction, undefined, "job-1")).rejects.toBeInstanceOf(
      OwnershipChangedError,
    );
  });
});
