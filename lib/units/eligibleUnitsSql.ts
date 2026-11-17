import { sql } from "drizzle-orm";
import { publicEvidenceSql } from "@/lib/sourcePublication/publicEvidenceSql";
import { publicSocialPostSql } from "@/lib/sourcePublication/publicSocialPostSql";
import { publicVaultSourceSql } from "@/lib/sourcePublication/publicVaultSourceSql";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";

/**
 * The units of one artist that a public read may return: the unit's source row still exists for
 * that artist, is public by the same rules as the public research corpus, and is still at the
 * revision the unit was cut from. Eligibility is checked here, at read time, never stored in the
 * index, so a unit whose source went private or changed disappears without a reindex.
 *
 * - vault: `publicVaultSourceSql()` and `vaultSourceRevisionSql` equal to the unit's revision;
 * - social: the artist's own post, not a repost or retweet, at `socialPostRevisionSql`;
 * - evidence: `publicEvidenceSql()` (confirmed candidate at its current revision) at `e.revision`.
 *
 * @param artistId - The artist, bound as a parameter.
 * @param alias - The `source_units` alias in the caller's query (a code constant; not `v`, `s`, `e` or `c`).
 */
export function eligibleUnitsSql(artistId: string, alias = "u") {
  const u = sql.raw(alias);
  return sql`(${u}.artist_id = ${artistId}::uuid and (
  (${u}.source_kind = 'vault' and exists (select 1 from artist_vault_sources v
    where v.id = ${u}.source_id and v.artist_id = ${u}.artist_id and ${publicVaultSourceSql()}
      and ${vaultSourceRevisionSql("v")} = ${u}.source_revision))
  or (${u}.source_kind = 'social' and exists (select 1 from artist_social_posts s
    where s.id = ${u}.source_id and s.artist_id = ${u}.artist_id and ${publicSocialPostSql()}
      and ${socialPostRevisionSql("s")} = ${u}.source_revision))
  or (${u}.source_kind = 'evidence' and exists (select 1 from artist_research_evidence e
    join artist_research_candidates c on c.id = e.candidate_id and c.artist_id = e.artist_id
    where e.id = ${u}.source_id and e.artist_id = ${u}.artist_id and ${publicEvidenceSql()}
      and e.revision = ${u}.source_revision))
))`;
}
