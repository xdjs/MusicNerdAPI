import { getActiveWorkers } from "@/lib/agentWork/getActiveWorkers";
import { getActivityPulse } from "@/lib/agentWork/getActivityPulse";
import { getHourlyActivity } from "@/lib/agentWork/getHourlyActivity";
import { getMappingStats } from "@/lib/mcp/getMappingStats";
import { getTodayCounts } from "@/lib/agentWork/getTodayCounts";
import type { AgentWorkSummary } from "@/lib/agentWork/types";

/**
 * The lightweight summary the Agent work tab loads on open: mapping stats
 * with today's counts, the activity pulse, hourly activity and workers, from
 * five concurrent queries.
 *
 * @returns The summary.
 */
export async function getAgentWorkSummary(): Promise<AgentWorkSummary> {
  const [stats, activityPulse, hourlyActivity, todayCounts, workers] = await Promise.all([
    getMappingStats(),
    getActivityPulse(),
    getHourlyActivity(),
    getTodayCounts(),
    getActiveWorkers(),
  ]);

  const statsWithToday = {
    ...stats,
    platformStats: stats.platformStats.map(p => ({
      ...p,
      todayCount: todayCounts[p.platform] ?? 0,
    })),
  };

  return { stats: statsWithToday, activityPulse, hourlyActivity, workers };
}
