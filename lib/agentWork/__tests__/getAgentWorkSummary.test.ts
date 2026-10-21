import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAgentWorkSummary } from "@/lib/agentWork/getAgentWorkSummary";

const mock = vi.hoisted(() => ({
  stats: vi.fn(),
  pulse: vi.fn(),
  hourly: vi.fn(),
  today: vi.fn(),
  workers: vi.fn(),
}));
vi.mock("@/lib/mcp/getMappingStats", () => ({ getMappingStats: mock.stats }));
vi.mock("@/lib/agentWork/getActivityPulse", () => ({ getActivityPulse: mock.pulse }));
vi.mock("@/lib/agentWork/getHourlyActivity", () => ({ getHourlyActivity: mock.hourly }));
vi.mock("@/lib/agentWork/getTodayCounts", () => ({ getTodayCounts: mock.today }));
vi.mock("@/lib/agentWork/getActiveWorkers", () => ({ getActiveWorkers: mock.workers }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.stats.mockResolvedValue({
    totalArtistsWithSpotify: 400,
    totalArtistsWithDeezer: 50,
    platformStats: [
      { platform: "deezer", mappedCount: 100, percentage: 25 },
      { platform: "genius", mappedCount: 0, percentage: 0 },
    ],
  });
  mock.pulse.mockResolvedValue({ lastWriteAt: null, rateLastHour: 0 });
  mock.hourly.mockResolvedValue([]);
  mock.today.mockResolvedValue({ deezer: 11 });
  mock.workers.mockResolvedValue([]);
});

describe("getAgentWorkSummary", () => {
  it("adds today's count to each platform and keeps the Deezer total", async () => {
    expect(await getAgentWorkSummary()).toEqual({
      stats: {
        totalArtistsWithSpotify: 400,
        totalArtistsWithDeezer: 50,
        platformStats: [
          { platform: "deezer", mappedCount: 100, percentage: 25, todayCount: 11 },
          { platform: "genius", mappedCount: 0, percentage: 0, todayCount: 0 },
        ],
      },
      activityPulse: { lastWriteAt: null, rateLastHour: 0 },
      hourlyActivity: [],
      workers: [],
    });
  });
});
