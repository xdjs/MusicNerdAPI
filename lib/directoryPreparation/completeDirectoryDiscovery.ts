import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { assertDirectoryDiscoveryScope } from "@/lib/ownership/assertDirectoryDiscoveryScope";
import type { ResearchJob } from "@/lib/research/types";
/** Save successful discovery and its reusable inputs under the original creation scope and exact lease. */
export async function completeDirectoryDiscovery(job: ResearchJob): Promise<boolean> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    await assertDirectoryDiscoveryScope(tx, job.artistId, job.activityId ?? undefined);
    const result = await tx.execute(sql`
      update artist_research_jobs j set status='done',claimed_at=null,last_error=null,updated_at=now(),
        state=jsonb_set(j.state,'{directoryDiscovery}',jsonb_build_object(
          'version',1,'identity',jsonb_build_object('name',a.name,'spotify',a.spotify,'deezer',a.deezer),
          'sourcesRevision',(select md5(coalesce(jsonb_agg(public.knowledge_vault_source_snapshot(v)-'status'-'updatedAt' order by v.id),'[]'::jsonb)::text)
            from artist_vault_sources v where v.artist_id=a.id and v.activity_id=j.activity_id and v.origin='research')))
      from artists a where a.id=${job.artistId}::uuid and j.artist_id=a.id and j.id=${job.id}::uuid
        and j.kind='source_search' and j.status='running' and j.attempts=${job.attempts}
        and j.updated_at=${job.updatedAt}::timestamptz and j.activity_id=${job.activityId}::uuid
        and j.state->'claimId'='null'::jsonb and j.state->>'purpose'='directory_preparation'
        and j.state->>'creationActivityId'=j.activity_id::text
      returning j.id`);
    return rowsOf(result).length > 0;
  });
}
