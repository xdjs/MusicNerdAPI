import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
/** Queue bounded private synthesis after source discovery, under its creation lineage. */
export async function queueDirectoryPreparation(artistId: string): Promise<void> {
  const scope = getArtistOperationOwnership(artistId);
  if (scope?.trigger !== "directory_add" || !scope.activityId || scope.expectedClaimId !== null)
    throw new Error("Invalid private preparation authority");
  await db.transaction(async tx => {
    await lockScopedArtistWrite(tx, artistId);
    await tx.execute(sql`insert into artist_research_jobs(artist_id,kind,status,activity_id,state)
   values(${artistId}::uuid,'lore_refresh','pending',${scope.activityId}::uuid,${JSON.stringify({ claimId: null, purpose: "directory_preparation", creationActivityId: scope.activityId })}::jsonb) on conflict do nothing`);
    const rows = rowsOf(
      await tx.execute(
        sql`select id from artist_research_jobs where artist_id=${artistId}::uuid and kind='lore_refresh' and status in ('pending','running') and activity_id=${scope.activityId}::uuid and state->>'purpose'='directory_preparation'`,
      ),
    );
    if (!rows.length) throw new Error("Private preparation queue is busy");
  });
}
