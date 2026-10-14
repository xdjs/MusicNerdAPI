import { directoryDiscoveryMatchesCurrentInputs } from "./directoryDiscoveryMatchesCurrentInputs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
/** Completed discovery can cross into the current approved claim; curation does not invalidate it. */
export async function hasReusableDirectoryDiscovery(
  artistId: string,
  claimId: string | null,
): Promise<boolean> {
  if (!claimId) return false;
  try {
    return (
      rowsOf(
        await db.execute(sql`select j.id
from artists a
join artist_activity_events e on e.artist_id=a.id
join artist_research_jobs j on j.artist_id=a.id and j.activity_id=e.id
where a.id=${artistId}::uuid
  and exists(select 1 from artist_claims c where c.id=${claimId}::uuid and c.artist_id=a.id and c.status='approved')
  and e.actor_kind='user' and e.action='directory_add' and e.trigger='directory_add'
  and e.actor_user_id=a.added_by
  and j.kind='source_search'
  and j.state->'claimId'='null'::jsonb
  and j.state->>'purpose'='directory_preparation'
  and j.state->>'creationActivityId'=e.id::text
  and ${directoryDiscoveryMatchesCurrentInputs()}
limit 1`),
      ).length > 0
    );
  } catch {
    console.error(
      "[hasReusableDirectoryDiscovery] Checkpoint read unavailable; using normal discovery",
    );
    return false;
  }
}
