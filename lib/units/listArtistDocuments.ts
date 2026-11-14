import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import { publicEvidenceSql } from "@/lib/sourcePublication/publicEvidenceSql";
import { publicSocialPostSql } from "@/lib/sourcePublication/publicSocialPostSql";
import { publicVaultSourceSql } from "@/lib/sourcePublication/publicVaultSourceSql";
import { socialPostTextSql } from "@/lib/sourcePublication/socialPostTextSql";
import type { UnitSourceKind } from "@/lib/units/types";

/** The most documents listed. */
const MAX_DOCUMENTS = 60;

/**
 * The sources of one artist a public read may show and that have text to index, with how many
 * current units each has.
 *
 * Sources: public vault rows (`publicVaultSourceSql`) with non-blank extracted text or a PDF,
 * public social posts (`publicSocialPostSql`) whose text (`socialPostTextSql`) is not blank, and
 * public evidence (`publicEvidenceSql`) with non-blank original text. Units are counted through
 * `eligibleUnitsSql`, so units cut from an older revision count as none.
 *
 * @param artistId - The artist.
 * @returns At most 60 entries: vault, then evidence, then social, each by title then id; `title`
 *   as `loadUnitSource` derives it ("Untitled" when it has none, as a social post never does);
 *   `indexing` when the source has no current units.
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
      select 'vault'::text as source_kind, 0 as kind_order, v.id as source_id,
             coalesce(v.title, v.file_name) as title, v.url
        from artist_vault_sources v
       where v.artist_id = ${artistId}::uuid and ${publicVaultSourceSql()}
         and (nullif(btrim(v.extracted_text), '') is not null or v.content_type = 'application/pdf')
      union all
      select 'evidence', 1, e.id, e.title, c.url
        from artist_research_evidence e
        join artist_research_candidates c on c.id = e.candidate_id and c.artist_id = e.artist_id
       where e.artist_id = ${artistId}::uuid and ${publicEvidenceSql()}
         and nullif(btrim(e.original_text), '') is not null
      union all
      select 'social', 2, s.id, null, s.url
        from artist_social_posts s
       where s.artist_id = ${artistId}::uuid and ${publicSocialPostSql()}
         and nullif(btrim(${socialPostTextSql()}), '') is not null
    )
    select d.source_kind, d.source_id::text as source_id, d.title, d.url,
           (select count(*) from source_units u
             where u.source_kind = d.source_kind and u.source_id = d.source_id
               and ${eligibleUnitsSql(artistId)})::int as units
      from sources d
     order by d.kind_order, lower(d.title) nulls last, d.source_id::text collate "C"
     limit ${MAX_DOCUMENTS}`);
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
