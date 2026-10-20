import { sql } from "drizzle-orm";
import { VALID_MAPPING_PLATFORMS } from "@/lib/agentWork/const";
import { getMappingExclusions } from "@/lib/agentWork/getMappingExclusions";
import type { AgentWorkDetails } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Up to 500 recent exclusions for each valid platform that has any; empty
 * platforms are skipped without a query.
 *
 * @returns `{ platforms }` keyed by platform.
 */
export async function getExclusionsByPlatform(): Promise<AgentWorkDetails["exclusions"]> {
  const counts = await db.execute<{ platform: string; total: number }>(sql`
    select platform, count(*)::int as total from artist_mapping_exclusions group by platform`);
  const withData = [...counts].filter(r => r.total > 0 && VALID_MAPPING_PLATFORMS.has(r.platform));
  const results = await Promise.all(withData.map(r => getMappingExclusions(r.platform, 500)));
  return { platforms: Object.fromEntries(withData.map((r, i) => [r.platform, results[i]])) };
}
