import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { ResearchJob } from "@/lib/research/types";
/** Checkpoint only the exact owned lease; stale workers cannot alter replacement jobs. */
export async function saveCatalogMatch(
  job: ResearchJob,
  state: Record<string, unknown>,
  status: "pending" | "done" | "failed",
  failure = false,
  writer: Pick<typeof db, "execute"> = db,
): Promise<boolean> {
  return (
    rowsOf(
      await writer.execute(
        sql`UPDATE artist_research_jobs SET state=${JSON.stringify(state)}::jsonb,status=${status},claimed_at=NULL,updated_at=clock_timestamp(),attempts=attempts+${failure ? 1 : 0},last_error=${status === "failed" ? String(state.outcome ?? "provider_failure") : null} WHERE id=${job.id}::uuid AND artist_id=${job.artistId}::uuid AND kind='catalog_match' AND status='running' AND updated_at=${job.updatedAt}::timestamptz RETURNING id`,
      ),
    ).length === 1
  );
}
