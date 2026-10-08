import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { toInterviewBoundary } from "@/lib/interviewMemory/toInterviewBoundary";
import { pageInterviewBoundaries } from "@/lib/interviewMemory/pageInterviewBoundaries";
import { validateBoundaryListQuery } from "@/lib/interviewMemory/validateBoundaryListQuery";
import type { BoundaryRow } from "@/lib/interviewMemory/types";
/** Read active instructions without loading answers, corrections or model memory. */
export async function loadInterviewBoundaries(
  artistId: string,
  userId: string,
  query: { sitting: number; cursor?: string },
) {
  const { sitting, cursor } = validateBoundaryListQuery(query);
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      const [latest] = await tx.execute<{ n: number }>(
        sql`select greatest(coalesce((select max(coalesce(sitting,1)) from artist_interview_answers where artist_id=${artistId}::uuid),0),coalesce((select max(sitting) from artist_interview_sessions where artist_id=${artistId}::uuid),0))::int as n`,
      );
      if (!latest) throw new Error("Interview sitting unavailable");
      if (sitting < Math.max(1, latest.n) || sitting > latest.n + 1)
        throw new KnowledgeError(
          "sitting_changed",
          409,
          "Interview sitting changed; restore the current or next sitting",
        );
      const rows = await tx.execute<BoundaryRow>(
        sql`select * from artist_interview_boundaries where artist_id=${artistId}::uuid and retracted_at is null and (scope='until_retracted' or sitting=${sitting}) order by created_at,id`,
      );
      return pageInterviewBoundaries(
        { artistId, sitting, boundaries: rows.map(toInterviewBoundary) },
        cursor,
      );
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
