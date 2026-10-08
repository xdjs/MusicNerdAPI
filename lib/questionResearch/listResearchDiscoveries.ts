import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { toResearchCandidate } from "@/lib/questionResearch/toResearchCandidate";
import type { ResearchCandidateRow, ResearchEvidenceRow } from "@/lib/questionResearch/types";
/** Read an authorized pending review page with each candidate's latest exact original. */
export async function listResearchDiscoveries(
  artistId: string,
  userId: string,
  limit: number,
  cursor?: string,
) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      const rows = await tx.execute<ResearchCandidateRow & { evidence: ResearchEvidenceRow }>(
        sql`select c.*,row_to_json(e) as evidence from artist_research_candidates c join lateral (select id,revision,title,original_text,provenance from artist_research_evidence where artist_id=c.artist_id and candidate_id=c.id and revision=c.current_revision limit 1) e on true where c.artist_id=${artistId}::uuid and c.curation='pending' ${cursor ? sql`and c.id>${cursor}::uuid` : sql``} order by c.id limit ${limit + 1}`,
      );
      return {
        status: "ok" as const,
        candidates: rows.slice(0, limit).map(r => toResearchCandidate(r, r.evidence)),
        nextCursor: rows.length > limit ? rows[limit - 1].id : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
