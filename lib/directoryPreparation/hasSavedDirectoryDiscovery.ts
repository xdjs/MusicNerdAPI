import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { assertDirectoryDiscoveryScope } from "@/lib/ownership/assertDirectoryDiscoveryScope";
import type { ResearchJob } from "@/lib/research/types";
import { directoryDiscoveryMatchesCurrentInputs } from "./directoryDiscoveryMatchesCurrentInputs";
/** Resume only downstream work while this exact directory worker owns unchanged completed discovery; null means its lease was replaced. */
export async function hasSavedDirectoryDiscovery(job: ResearchJob): Promise<boolean | null> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    await assertDirectoryDiscoveryScope(tx, job.artistId, job.activityId ?? undefined);
    const [row] = rowsOf(
      await tx.execute(sql`select coalesce((${directoryDiscoveryMatchesCurrentInputs()}),false) as reusable from artist_research_jobs j join artists a on a.id=j.artist_id
      where j.id=${job.id}::uuid and j.artist_id=${job.artistId}::uuid and j.activity_id=${job.activityId}::uuid
        and j.kind='source_search' and j.status='running' and j.attempts=${job.attempts} and j.updated_at=${job.updatedAt}::timestamptz
        and j.state->'claimId'='null'::jsonb and j.state->>'purpose'='directory_preparation' and j.state->>'creationActivityId'=j.activity_id::text`),
    ) as { reusable: boolean }[];
    return row ? row.reusable : null;
  });
}
