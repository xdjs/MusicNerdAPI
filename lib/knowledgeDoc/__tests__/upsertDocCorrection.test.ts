import { describe, it, expect, vi } from "vitest";

const mock = vi.hoisted(() => ({ withWrite: vi.fn() }));
vi.mock("@/lib/ownership/withArtistUploadWrite", () => ({ withArtistUploadWrite: mock.withWrite }));
const { upsertDocCorrection } = await import("@/lib/knowledgeDoc/upsertDocCorrection");

describe("upsertDocCorrection", () => {
  it("upserts on (artist, claim) under the claim-checked artist write", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const tx = { insert: vi.fn(() => ({ values })) };
    mock.withWrite.mockImplementation(async (_a, _u, _c, write) => write(tx));
    await upsertDocCorrection("a1", "Claim.", "fix", "Mine.", {
      userId: "u1",
      expectedClaimId: "c1",
    });
    expect(mock.withWrite).toHaveBeenCalledWith("a1", "u1", "c1", expect.any(Function));
    expect(values).toHaveBeenCalledWith({
      artistId: "a1",
      claim: "Claim.",
      kind: "fix",
      correction: "Mine.",
    });
    const conflict = onConflictDoUpdate.mock.calls[0][0];
    expect(conflict.target).toHaveLength(2);
    expect(conflict.set).toMatchObject({ kind: "fix", correction: "Mine." });
    expect(conflict.set.updatedAt).toBeDefined();
  });
});
