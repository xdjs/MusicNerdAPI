import { sql } from "drizzle-orm";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { getMappingExclusions } from "@/lib/mcp/getMappingExclusions";
import type { AgentWorkDetails } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Exclusions grouped by platform, up to 500 each; platforms with none are
 * left out, as are rows for platforms no longer valid.
 *
 * @returns The platforms map.
 */
export async function getExclusionsByPlatform(): Promise<AgentWorkDetails["exclusions"]> {
  // First, get counts per platform to skip empty ones
  const countRows = await db.execute<{ platform: string; total: number }>(sql`
    SELECT platform, COUNT(*)::int AS total
    FROM artist_mapping_exclusions
    GROUP BY platform
  `);

  const platformsWithData = [...countRows].filter(
    row => row.total > 0 && VALID_MAPPING_PLATFORMS.has(row.platform),
  );

  if (platformsWithData.length === 0) {
    return { platforms: {} };
  }

  // Fetch details only for platforms with exclusions
  const results = await Promise.all(
    platformsWithData.map(({ platform }) => getMappingExclusions(platform, 500)),
  );

  const platforms: AgentWorkDetails["exclusions"]["platforms"] = {};
  platformsWithData.forEach(({ platform }, i) => {
    platforms[platform] = results[i];
  });

  return { platforms };
}
