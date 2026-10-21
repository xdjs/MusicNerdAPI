import { sql } from "drizzle-orm";
import type { AgentBreakdownRow } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * What each MCP key has done: mappings resolved by confidence and source,
 * exclusions, and when it last wrote to the audit log.
 *
 * @returns One row per key, most resolved first, then keys with only exclusions.
 */
export async function getAgentBreakdown(): Promise<{ agents: AgentBreakdownRow[] }> {
  const [mappingRows, exclusionRows, lastActiveRows] = await Promise.all([
    db.execute<{
      api_key_hash: string;
      agent_label: string | null;
      total: number;
      high: number;
      medium: number;
      low: number;
      manual: number;
      src_wikidata: number;
      src_musicbrainz: number;
      src_name_search: number;
      src_web_search: number;
      src_manual: number;
    }>(sql`
      SELECT
        m.api_key_hash,
        k.label AS agent_label,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE m.confidence = 'high')::int AS high,
        COUNT(*) FILTER (WHERE m.confidence = 'medium')::int AS medium,
        COUNT(*) FILTER (WHERE m.confidence = 'low')::int AS low,
        COUNT(*) FILTER (WHERE m.confidence = 'manual')::int AS manual,
        COUNT(*) FILTER (WHERE m.source = 'wikidata')::int AS src_wikidata,
        COUNT(*) FILTER (WHERE m.source = 'musicbrainz')::int AS src_musicbrainz,
        COUNT(*) FILTER (WHERE m.source = 'name_search')::int AS src_name_search,
        COUNT(*) FILTER (WHERE m.source = 'web_search')::int AS src_web_search,
        COUNT(*) FILTER (WHERE m.source = 'manual')::int AS src_manual
      FROM artist_id_mappings m
      LEFT JOIN mcp_api_keys k ON k.key_hash = m.api_key_hash
      WHERE m.api_key_hash IS NOT NULL
      GROUP BY m.api_key_hash, k.label
      ORDER BY total DESC
    `),
    db.execute<{ api_key_hash: string; agent_label: string | null; total: number }>(sql`
      SELECT
        e.api_key_hash,
        k.label AS agent_label,
        COUNT(*)::int AS total
      FROM artist_mapping_exclusions e
      LEFT JOIN mcp_api_keys k ON k.key_hash = e.api_key_hash
      WHERE e.api_key_hash IS NOT NULL
      GROUP BY e.api_key_hash, k.label
    `),
    db.execute<{ api_key_hash: string; last_active_at: string | null }>(sql`
      SELECT api_key_hash, MAX(created_at) AS last_active_at
      FROM mcp_audit_log
      GROUP BY api_key_hash
    `),
  ]);

  // Build a lookup for last active times
  const lastActiveMap = new Map<string, string | null>();
  for (const row of lastActiveRows) {
    lastActiveMap.set(row.api_key_hash, row.last_active_at);
  }

  // Merge mappings and exclusions by api_key_hash
  const agentMap = new Map<string, AgentBreakdownRow>();

  for (const row of mappingRows) {
    agentMap.set(row.api_key_hash, {
      label: row.agent_label,
      apiKeyHash: row.api_key_hash,
      resolvedCount: row.total,
      excludedCount: 0,
      lastActiveAt: lastActiveMap.get(row.api_key_hash) ?? null,
      byConfidence: { high: row.high, medium: row.medium, low: row.low, manual: row.manual },
      bySource: {
        wikidata: row.src_wikidata,
        musicbrainz: row.src_musicbrainz,
        name_search: row.src_name_search,
        web_search: row.src_web_search,
        manual: row.src_manual,
      },
    });
  }

  for (const row of exclusionRows) {
    const existing = agentMap.get(row.api_key_hash);
    if (existing) {
      existing.excludedCount = row.total;
    } else {
      agentMap.set(row.api_key_hash, {
        label: row.agent_label,
        apiKeyHash: row.api_key_hash,
        resolvedCount: 0,
        excludedCount: row.total,
        lastActiveAt: lastActiveMap.get(row.api_key_hash) ?? null,
        byConfidence: { high: 0, medium: 0, low: 0, manual: 0 },
        bySource: { wikidata: 0, musicbrainz: 0, name_search: 0, web_search: 0, manual: 0 },
      });
    }
  }

  return { agents: [...agentMap.values()] };
}
