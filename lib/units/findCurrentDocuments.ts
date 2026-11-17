import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { publicEvidenceSql } from "@/lib/sourcePublication/publicEvidenceSql";
import { publicSocialPostSql } from "@/lib/sourcePublication/publicSocialPostSql";
import { publicVaultSourceSql } from "@/lib/sourcePublication/publicVaultSourceSql";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import type { UnitSourceKind } from "@/lib/units/types";

/**
 * Which of the given documents a public read may still show at the revision given: the source row
 * exists for this artist, is public, and is at that revision, by the same per-kind predicates as
 * `eligibleUnitsSql`, checked on the source tables (not `source_units`, so a document whose units
 * are still being re-cut is judged by its source alone).
 *
 * One query over a bound `values` list of every ref; none for an empty list.
 *
 * @param artistId - The artist.
 * @param refs - The documents and the revisions they were read at.
 * @returns The keys `${sourceKind}:${sourceId}:${revision}` of the refs that are current. The
 *   revision is part of the key so two revisions of one document are told apart.
 */
export async function findCurrentDocuments(
  artistId: string,
  refs: { sourceKind: UnitSourceKind; sourceId: string; revision: string }[],
): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const values = sql.join(
    refs.map(ref => sql`(${ref.sourceKind}::text, ${ref.sourceId}::uuid, ${ref.revision}::text)`),
    sql`, `,
  );
  const rows = await db.execute<{ source_kind: string; source_id: string; revision: string }>(sql`
    select r.source_kind, r.source_id::text as source_id, r.revision
      from (values ${values}) as r(source_kind, source_id, revision)
     where (r.source_kind = 'vault' and exists (select 1 from artist_vault_sources v
             where v.id = r.source_id and v.artist_id = ${artistId}::uuid and ${publicVaultSourceSql()}
               and ${vaultSourceRevisionSql("v")} = r.revision))
        or (r.source_kind = 'social' and exists (select 1 from artist_social_posts s
             where s.id = r.source_id and s.artist_id = ${artistId}::uuid and ${publicSocialPostSql()}
               and ${socialPostRevisionSql("s")} = r.revision))
        or (r.source_kind = 'evidence' and exists (select 1 from artist_research_evidence e
             join artist_research_candidates c on c.id = e.candidate_id and c.artist_id = e.artist_id
             where e.id = r.source_id and e.artist_id = ${artistId}::uuid and ${publicEvidenceSql()}
               and e.revision = r.revision))`);
  return new Set(rows.map(row => `${row.source_kind}:${row.source_id}:${row.revision}`));
}
