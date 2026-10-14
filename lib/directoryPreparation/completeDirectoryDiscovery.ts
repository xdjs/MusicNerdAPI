import { directoryDiscoveryMatchesCurrentInputs } from "./directoryDiscoveryMatchesCurrentInputs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { assertDirectoryDiscoveryScope } from "@/lib/ownership/assertDirectoryDiscoveryScope";
import type { ResearchJob } from "@/lib/research/types";
/** Complete downstream handoff without renewing the saved discovery timestamp. */
export async function completeDirectoryDiscovery(job: ResearchJob): Promise<boolean> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    await assertDirectoryDiscoveryScope(tx, job.artistId, job.activityId ?? undefined);
    const result = await tx.execute(sql`
      update artist_research_jobs j set status='done',claimed_at=null,last_error=null,updated_at=now()
      from artists a where a.id=${job.artistId}::uuid and j.artist_id=a.id and j.id=${job.id}::uuid
        and j.kind='source_search' and j.status='running' and j.attempts=${job.attempts}
        and j.updated_at=${job.updatedAt}::timestamptz and j.activity_id=${job.activityId}::uuid
        and j.state->'claimId'='null'::jsonb and j.state->>'purpose'='directory_preparation'
        and j.state->>'creationActivityId'=j.activity_id::text
        and ${directoryDiscoveryMatchesCurrentInputs()}
      returning j.id`);
    return rowsOf(result).length > 0;
  });
}
