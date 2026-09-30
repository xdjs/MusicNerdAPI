import { sql } from "drizzle-orm";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { JobKind } from "@/lib/research/types";

/**
 * Clears an artist's finished jobs of one kind, so a new one can be queued.
 * Only done or failed rows go; a live job is left alone.
 *
 * @param artistId - The artist.
 * @param kind - The job kind.
 * @returns Nothing; a changed claim throws, any other error is logged.
 */
export async function reopenResearchJob(artistId: string, kind: JobKind): Promise<void> {
  try {
    await withScopedArtistWrite(artistId, async tx => {
      await tx.execute(sql`
        delete from artist_research_jobs
         where artist_id = ${artistId}::uuid and kind = ${kind} and status in ('done', 'failed')`);
    });
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw e;
    console.error("[reopenResearchJob] Error:", e);
  }
}
