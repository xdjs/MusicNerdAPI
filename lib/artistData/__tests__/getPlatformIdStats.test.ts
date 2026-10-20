import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getPlatformIdStats } = await import("@/lib/artistData/getPlatformIdStats");

describe("getPlatformIdStats", () => {
  it("maps platform to all-time and today counts", async () => {
    execute.mockResolvedValueOnce([{ platform: "deezer", count: 9, today_count: 1 }]);
    expect([...(await getPlatformIdStats())]).toEqual([["deezer", { count: 9, todayCount: 1 }]]);
  });
});
