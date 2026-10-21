import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ execute: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({
  withScopedArtistWrite: async (_artistId: string, fn: (tx: unknown) => unknown) =>
    fn({ execute: m.execute }),
}));
vi.mock("@/lib/latest/findLatestRefreshId", () => ({ findLatestRefreshId: m.find }));
const { draftLatestRefresh } = await import("@/lib/latest/draftLatestRefresh");

const context = { userId: "u1", expectedClaimId: "c1" };

beforeEach(() => {
  m.execute.mockReset().mockResolvedValue([]);
  m.find.mockReset().mockResolvedValue(null);
});

describe("draftLatestRefresh", () => {
  it("releases out-of-scope jobs first, under the artist lock", async () => {
    m.find.mockResolvedValueOnce("job-0");
    await draftLatestRefresh("a1", context);
    expect(JSON.stringify(m.execute.mock.calls[0][0])).toContain("Refresh scope changed");
  });

  it("returns the live or cooling-down request instead of a new one", async () => {
    m.find.mockResolvedValueOnce("job-0");
    expect(await draftLatestRefresh("a1", context)).toBe("job-0");
    expect(m.execute).toHaveBeenCalledTimes(1);
  });

  it("drafts the request from the artist's current connections", async () => {
    m.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ instagram: "ig", inprocess: null, spotify: "sp", deezer: null }]);
    expect(await draftLatestRefresh("a1", context)).toEqual({
      claimId: "c1",
      userId: "u1",
      instagram: "ig",
      inprocess: "",
      spotify: "sp",
      deezer: "",
      sources: {
        instagram: { status: "pending" },
        inprocess: { status: "disconnected" },
        spotify: { status: "pending" },
        deezer: { status: "disconnected" },
        interviews: { status: "pending" },
      },
    });
  });

  it("fails for an unknown artist", async () => {
    m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(draftLatestRefresh("a1", context)).rejects.toThrow("Artist not found");
  });
});
