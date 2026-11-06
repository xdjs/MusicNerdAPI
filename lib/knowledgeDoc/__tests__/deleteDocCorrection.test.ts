import { describe, it, expect, vi } from "vitest";

const mock = vi.hoisted(() => ({ withWrite: vi.fn() }));
vi.mock("@/lib/ownership/withArtistUploadWrite", () => ({ withArtistUploadWrite: mock.withWrite }));
const { deleteDocCorrection } = await import("@/lib/knowledgeDoc/deleteDocCorrection");

describe("deleteDocCorrection", () => {
  it("deletes the artist's correction under the claim-checked artist write", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const tx = { delete: vi.fn(() => ({ where })) };
    mock.withWrite.mockImplementation(async (_a, _u, _c, write) => write(tx));
    await deleteDocCorrection("a1", "k1", { userId: "u1", expectedClaimId: null });
    expect(mock.withWrite).toHaveBeenCalledWith("a1", "u1", null, expect.any(Function));
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
