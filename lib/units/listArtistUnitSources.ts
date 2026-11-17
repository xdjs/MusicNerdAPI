import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import { UNIT_INGEST_VERSION } from "@/lib/units/types";
import type { UnitSourceKind, UnitSyncEntry } from "@/lib/units/types";

/**
 * Every source of one artist the text index should hold, next to what the index holds for it.
 *
 * Sources: vault rows with extracted text or a PDF that are not rejected (never public, so never worth paid OCR or embeddings), the artist's own posts that are not reposts or
 * retweets, and evidence at its candidate's current revision for a confirmed candidate still pending
 * or approved (the public corpus's scope, `loadPublicResearchOriginals`). Units whose row no longer
 * exists in its table come back as orphans with a null `sourceRevision`. Units of a row that exists
 * but does not count right now are left out: neither ingested nor deleted, since eligibility is
 * checked when the index is read, never cached in it. A source whose units were written by an
 * ingest older than `UNIT_INGEST_VERSION` reports a null `indexedRevision`, so it is rebuilt.
 *
 * @param artistId - The artist.
 * @returns One entry per source, ordered by kind then id in byte order (`collate "C"`), the order `runUnitSync` resumes in.
 */
export async function listArtistUnitSources(artistId: string): Promise<UnitSyncEntry[]> {
  const rows = await db.execute<{
    source_kind: UnitSourceKind;
    source_id: string;
    source_revision: string | null;
    indexed_revision: string | null;
    needs_embedding: boolean;
  }>(sql`
    with sources as (
      select 'vault'::text as source_kind, v.id as source_id, ${vaultSourceRevisionSql()} as source_revision
        from artist_vault_sources v
       where v.artist_id = ${artistId}::uuid
         and v.status is distinct from 'rejected'
         and (v.extracted_text is not null or v.content_type = 'application/pdf')
      union all
      select 'social', s.id, ${socialPostRevisionSql()}
        from artist_social_posts s
       where s.artist_id = ${artistId}::uuid and s.is_own_post = true
         and s.raw->'isRepost' is distinct from 'true'::jsonb
         and s.raw->'isRetweet' is distinct from 'true'::jsonb
      union all
      select 'evidence', e.id, e.revision
        from artist_research_evidence e
        join artist_research_candidates c on c.id = e.candidate_id and c.artist_id = e.artist_id
       where c.artist_id = ${artistId}::uuid and e.revision = c.current_revision
         and c.identity = 'confirmed' and c.curation in ('pending', 'approved')
    ),
    indexed as (
      select u.source_kind, u.source_id,
             -- Units from an older ingest are stale whatever their revision: they are rebuilt.
             case when count(distinct u.source_revision) = 1
                   and min(u.ingest_version) >= ${UNIT_INGEST_VERSION}
                  then min(u.source_revision) end as indexed_revision,
             bool_or(u.embedding is null) as needs_embedding
        from source_units u
       where u.artist_id = ${artistId}::uuid
       group by u.source_kind, u.source_id
    )
    select * from (
      select s.source_kind, s.source_id::text as source_id, s.source_revision,
             i.indexed_revision, coalesce(i.needs_embedding, false) as needs_embedding
        from sources s
        left join indexed i on i.source_kind = s.source_kind and i.source_id = s.source_id
      union all
      select i.source_kind, i.source_id::text, null, i.indexed_revision, i.needs_embedding
        from indexed i
       where case i.source_kind
               when 'vault' then not exists (select 1 from artist_vault_sources v where v.id = i.source_id)
               when 'social' then not exists (select 1 from artist_social_posts s where s.id = i.source_id)
               when 'evidence' then not exists (select 1 from artist_research_evidence e where e.id = i.source_id)
               else false
             end
    ) listed
     order by source_kind collate "C", source_id collate "C"`);
  return rows.map(row => ({
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    sourceRevision: row.source_revision,
    indexedRevision: row.indexed_revision,
    needsEmbedding: row.needs_embedding === true,
  }));
}
