import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import type { PreparedSource } from "./types";
import type { DocSource } from "@/lib/lore/types";
/** Claimant-only read: reuse requires explicit approval of every unchanged original and no newer personal material. */
export async function getReusableDirectoryDraft(
  artistId: string,
): Promise<{ document: string; about: string; sources: DocSource[] } | null> {
  const scope = getArtistOperationOwnership(artistId);
  if (!scope?.userId || !scope.expectedClaimId) return null;
  const [row] = rowsOf(
    await db.execute(sql`select p.document,p.about,p.manifest from artist_directory_preparations p join artists a on a.id=p.artist_id
  where p.artist_id=${artistId}::uuid and p.status='ready' and p.document is not null and p.about is not null
   and a.bio is not distinct from p.starting_bio
   and exists(select 1 from artist_claims c where c.id=${scope.expectedClaimId}::uuid and c.artist_id=a.id and c.user_id=${scope.userId}::uuid and c.status='approved')
   and jsonb_array_length(p.manifest)>0
   and not exists(select 1 from artist_interview_answers where artist_id=a.id)
   and not exists(select 1 from artist_doc_corrections where artist_id=a.id)
   and (select count(*) from artist_vault_sources v where v.artist_id=a.id and v.status='approved')=jsonb_array_length(p.manifest)
   and not exists(select 1 from jsonb_array_elements(p.manifest) snapshot
     left join artist_vault_sources v on v.id=(snapshot->>'id')::uuid and v.artist_id=a.id
     where v.id is null or v.status<>'approved' or (public.knowledge_vault_source_snapshot(v)-'status'-'updatedAt')<>(snapshot-'status'-'updatedAt'))
  limit 1`),
  ) as { document: string; about: string; manifest: PreparedSource[] }[];
  if (!row) return null;
  return {
    document: row.document,
    about: row.about,
    sources: row.manifest.map((s, i) => ({
      id: i + 1,
      kind: "vault",
      label: s.title ?? s.url,
      url: s.url,
      publishedAt: s.publishedAt,
    })),
  };
}
