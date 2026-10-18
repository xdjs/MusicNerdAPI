import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import type { KnowledgeToolConfig } from "./types";
/** Prefer unopened interview threads without removing any mandatory question history. */
export async function fetchPreviouslyCitedInterviewSources(config: KnowledgeToolConfig) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, config.artistId, config.userId);
      const rows = await tx.execute<{ source_id: string }>(
        sql`select distinct reference->>'sourceId' as source_id from artist_interview_question_evidence e cross join lateral jsonb_array_elements(e.evidence_references) reference where e.artist_id=${config.artistId}::uuid and reference->>'kind'='original' and reference->>'sourceId' is not null limit 500`,
      );
      return new Set(rows.map(row => row.source_id));
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
