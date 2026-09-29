import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { toResearchJob } from "@/lib/research/toResearchJob";
import type { ResearchJob } from "@/lib/research/types";

/**
 * Every research job an artist has, any kind or status.
 *
 * @param artistId - The artist.
 * @returns The jobs; empty on a database error.
 */
export async function getResearchJobs(artistId: string): Promise<ResearchJob[]> {
  try {
    const rows = await db.execute(
      sql`select * from artist_research_jobs where artist_id = ${artistId}::uuid`,
    );
    return rowsOf(rows).map(r => toResearchJob(r as Record<string, unknown>));
  } catch (e) {
    console.error("[getResearchJobs] Error:", e);
    return [];
  }
}
