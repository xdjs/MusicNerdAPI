import { getActiveWorkers } from "@/lib/agentWork/getActiveWorkers";
import { getActivityPulse } from "@/lib/agentWork/getActivityPulse";
import { getHourlyActivity } from "@/lib/agentWork/getHourlyActivity";
import { getMappingStats } from "@/lib/agentWork/getMappingStats";
import { getTodayCounts } from "@/lib/agentWork/getTodayCounts";
import type { AgentWorkSummary } from "@/lib/agentWork/types";

/**
 * The Agent Work tab's light first load: mapping coverage with today's counts,
 * the activity pulse, the last 24 hours and the workers.
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
  return {
    stats: {
      ...stats,
      platformStats: stats.platformStats.map(p => ({
        ...p,
        todayCount: todayCounts[p.platform] ?? 0,
      })),
    },
    activityPulse,
    hourlyActivity,
    workers,
  };
}
