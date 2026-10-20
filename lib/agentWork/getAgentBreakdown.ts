import { sql } from "drizzle-orm";
import type { AgentBreakdownRow } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Per agent key: mappings resolved by confidence and source, exclusions, and
 * when it was last active. Agents with only exclusions are listed too.
 *
 * @returns `{ agents }`, busiest resolver first.
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
    }>(sql`select m.api_key_hash, k.label as agent_label, count(*)::int as total,
        count(*) filter (where m.confidence = 'high')::int as high,
        count(*) filter (where m.confidence = 'medium')::int as medium,
        count(*) filter (where m.confidence = 'low')::int as low,
        count(*) filter (where m.confidence = 'manual')::int as manual,
        count(*) filter (where m.source = 'wikidata')::int as src_wikidata,
        count(*) filter (where m.source = 'musicbrainz')::int as src_musicbrainz,
        count(*) filter (where m.source = 'name_search')::int as src_name_search,
        count(*) filter (where m.source = 'web_search')::int as src_web_search,
        count(*) filter (where m.source = 'manual')::int as src_manual
      from artist_id_mappings m left join mcp_api_keys k on k.key_hash = m.api_key_hash
      where m.api_key_hash is not null group by m.api_key_hash, k.label order by total desc`),
    db.execute<{ api_key_hash: string; agent_label: string | null; total: number }>(sql`
      select e.api_key_hash, k.label as agent_label, count(*)::int as total
      from artist_mapping_exclusions e left join mcp_api_keys k on k.key_hash = e.api_key_hash
      where e.api_key_hash is not null group by e.api_key_hash, k.label`),
    db.execute<{ api_key_hash: string; last_active_at: string | null }>(sql`
      select api_key_hash, max(created_at) as last_active_at from mcp_audit_log group by api_key_hash`),
  ]);
  const lastActive = new Map([...lastActiveRows].map(r => [r.api_key_hash, r.last_active_at]));
  const agents = new Map<string, AgentBreakdownRow>();
  for (const r of mappingRows)
    agents.set(r.api_key_hash, {
      label: r.agent_label,
      apiKeyHash: r.api_key_hash,
      resolvedCount: r.total,
      excludedCount: 0,
      lastActiveAt: lastActive.get(r.api_key_hash) ?? null,
      byConfidence: { high: r.high, medium: r.medium, low: r.low, manual: r.manual },
      bySource: {
        wikidata: r.src_wikidata,
        musicbrainz: r.src_musicbrainz,
        name_search: r.src_name_search,
        web_search: r.src_web_search,
        manual: r.src_manual,
      },
    });
  for (const r of exclusionRows) {
    const existing = agents.get(r.api_key_hash);
    if (existing) existing.excludedCount = r.total;
    else
      agents.set(r.api_key_hash, {
        label: r.agent_label,
        apiKeyHash: r.api_key_hash,
        resolvedCount: 0,
        excludedCount: r.total,
        lastActiveAt: lastActive.get(r.api_key_hash) ?? null,
        byConfidence: { high: 0, medium: 0, low: 0, manual: 0 },
        bySource: { wikidata: 0, musicbrainz: 0, name_search: 0, web_search: 0, manual: 0 },
      });
  }
  return { agents: [...agents.values()] };
}
