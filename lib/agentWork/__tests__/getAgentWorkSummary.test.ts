import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/agentWork/getMappingStats", () => ({
  getMappingStats: async () => ({
    totalArtistsWithSpotify: 10,
    totalArtistsWithDeezer: 5,
    platformStats: [
      { platform: "deezer", mappedCount: 5, percentage: 50 },
      { platform: "tidal", mappedCount: 0, percentage: 0 },
    ],
  }),
}));
vi.mock("@/lib/agentWork/getActivityPulse", () => ({
  getActivityPulse: async () => ({ lastWriteAt: null, rateLastHour: 0 }),
}));
vi.mock("@/lib/agentWork/getHourlyActivity", () => ({ getHourlyActivity: async () => [] }));
vi.mock("@/lib/agentWork/getTodayCounts", () => ({ getTodayCounts: async () => ({ deezer: 2 }) }));
vi.mock("@/lib/agentWork/getActiveWorkers", () => ({ getActiveWorkers: async () => [] }));
const { getAgentWorkSummary } = await import("@/lib/agentWork/getAgentWorkSummary");

describe("getAgentWorkSummary", () => {
  it("adds today's count to each platform", async () => {
    const summary = await getAgentWorkSummary();
    expect(summary.stats.platformStats).toEqual([
      { platform: "deezer", mappedCount: 5, percentage: 50, todayCount: 2 },
      { platform: "tidal", mappedCount: 0, percentage: 0, todayCount: 0 },
    ]);
    expect(summary).toMatchObject({
      activityPulse: { lastWriteAt: null, rateLastHour: 0 },
      hourlyActivity: [],
      workers: [],
    });
  });
});
