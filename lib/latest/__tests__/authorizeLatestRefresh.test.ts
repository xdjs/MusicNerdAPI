import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ operation: vi.fn(), write: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation: m.operation }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: m.write }));
const { authorizeLatestRefresh } = await import("@/lib/latest/authorizeLatestRefresh");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const job = (state: Record<string, unknown>, activityId: string | null = "act-1") =>
  ({ id: "job-1", artistId: "artist-1", activityId, state }) as never;

beforeEach(() => {
  m.operation.mockReset().mockImplementation((_a, _o, fn) => fn());
  m.write.mockReset().mockImplementation(async (_a, fn) => fn({ execute: m.execute }));
  m.execute.mockReset().mockResolvedValue([{ id: "artist-1" }]);
});

describe("authorizeLatestRefresh", () => {
  it("runs as the requester under the claim they asked with", async () => {
    await authorizeLatestRefresh(job({ userId: "u1", claimId: "c1", instagram: "h" }));
    expect(m.operation.mock.calls[0].slice(0, 2)).toEqual([
      "artist-1",
      {
        userId: "u1",
        expectedClaimId: "c1",
        activityId: "act-1",
        trigger: "manual_latest_refresh",
      },
    ]);
  });

  it("rejects a job without its attribution", async () => {
    await expect(authorizeLatestRefresh(job({ userId: "u1" }))).rejects.toThrow(
      "Missing Latest attribution",
    );
    await expect(
      authorizeLatestRefresh(job({ userId: "u1", claimId: null }, null)),
    ).rejects.toThrow();
  });

  it("cancels when the connected identities changed", async () => {
    m.execute.mockResolvedValueOnce([]);
    await expect(
      authorizeLatestRefresh(job({ userId: "u1", claimId: null, instagram: "h" })),
    ).rejects.toBeInstanceOf(OwnershipChangedError);
  });
});
