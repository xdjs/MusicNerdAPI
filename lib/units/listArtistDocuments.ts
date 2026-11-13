import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import { publicEvidenceSql } from "@/lib/sourcePublication/publicEvidenceSql";
import { publicVaultSourceSql } from "@/lib/sourcePublication/publicVaultSourceSql";
import type { UnitSourceKind } from "@/lib/units/types";

/**
 * Every source of one artist a public read may show, with how many current units it has.
 *
 * Sources: public vault rows (`publicVaultSourceSql`) with extracted text or a PDF, the artist's
 * own posts that are not reposts or retweets, and public evidence (`publicEvidenceSql`). Units are
 * counted through `eligibleUnitsSql`, so units cut from an older revision count as none.
 *
 * @param artistId - The artist.
 * @returns One entry per source, ordered by kind then id; `title` as `loadUnitSource` derives it
 *   ("Untitled" when it has none, as a social post never does); `indexing` when the source has no current units.
 */
export async function listArtistDocuments(artistId: string): Promise<
  {
    sourceKind: UnitSourceKind;
    sourceId: string;
    title: string;
    url: string | null;
    units: number;
    indexing: boolean;
  }[]
> {
  const rows = await db.execute<{
    source_kind: UnitSourceKind;
    source_id: string;
    title: string | null;
    url: string | null;
    units: number;
  }>(sql`
    with sources as (
      select 'vault'::text as source_kind, v.id as source_id, coalesce(v.title, v.file_name) as title, v.url
        from artist_vault_sources v
       where v.artist_id = ${artistId}::uuid and ${publicVaultSourceSql()}
         and (v.extracted_text is not null or v.content_type = 'application/pdf')
      union all
      select 'social', s.id, null, s.url
        from artist_social_posts s
       where s.artist_id = ${artistId}::uuid and s.is_own_post = true
         and s.raw->'isRepost' is distinct from 'true'::jsonb
         and s.raw->'isRetweet' is distinct from 'true'::jsonb
      union all
      select 'evidence', e.id, e.title, c.url
        from artist_research_evidence e
        join artist_research_candidates c on c.id = e.candidate_id and c.artist_id = e.artist_id
       where e.artist_id = ${artistId}::uuid and ${publicEvidenceSql()}
    )
    select d.source_kind, d.source_id::text as source_id, d.title, d.url,
           (select count(*) from source_units u
             where u.source_kind = d.source_kind and u.source_id = d.source_id
               and ${eligibleUnitsSql(artistId)})::int as units
      from sources d
     order by d.source_kind collate "C", d.source_id::text collate "C"`);
  return rows.map(row => {
    const units = Number(row.units);
    return {
      sourceKind: row.source_kind,
      sourceId: row.source_id,
      title: row.title ?? "Untitled",
      url: row.url,
      units,
      indexing: units === 0,
    };
  });
}
