import { sql } from "drizzle-orm";
import { publicTextVaultSourceSql } from "./publicTextVaultSourceSql";

/**
 * Public research evidence: the evidence row is its candidate's current revision, the candidate is a
 * confirmed identity still pending or approved, its URL is not one the artist made private in the
 * vault, and its review destination (if any) is itself still public.
 *
 * @param aliases - The aliases of the joined `artist_research_evidence` and `artist_research_candidates` rows (code constants, never input).
 */
export function publicEvidenceSql(aliases: { e: string; c: string } = { e: "e", c: "c" }) {
  const e = sql.raw(aliases.e);
  const c = sql.raw(aliases.c);
  return sql`(${e}.revision=${c}.current_revision and ${c}.identity='confirmed' and ${c}.curation in ('pending','approved') and not exists(select 1 from artist_vault_sources hidden where hidden.artist_id=${c}.artist_id and hidden.url=${c}.url and hidden.publication='private') and ((${c}.reviewed_revision is null and (${c}.destination is distinct from 'lore' or ${c}.source_id is null)) or (${c}.destination='lore' and exists(select 1 from artist_vault_sources v where v.id=${c}.source_id and v.artist_id=${c}.artist_id and ${publicTextVaultSourceSql()})) or (${c}.destination='link' and exists(select 1 from artists a where a.id=${c}.artist_id and to_jsonb(a)->>${c}.platform=${c}.platform_id))))`;
}
