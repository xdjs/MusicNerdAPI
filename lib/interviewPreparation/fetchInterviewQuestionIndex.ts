import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import type { KnowledgeToolConfig } from "./types";
/** Read only prior question text; loading the source archive is unnecessary for repetition checks. */
export async function fetchInterviewQuestionIndex(
  config: KnowledgeToolConfig,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, config.artistId, config.userId);
      const [size] = await tx.execute<{ chars: number; count: number }>(
        sql`select coalesce(sum(char_length(question)),0)::int as chars,count(*)::int as count from artist_interview_answers where artist_id=${config.artistId}::uuid`,
      );
      if (!size || size.chars > 16000 || size.count > 500)
        throw new Error("Prior questions exceed their model context budget");
      const rows = await tx.execute<{
        id: string;
        question_key: string;
        question: string;
        source: string;
        sitting: number | null;
      }>(
        sql`select id,question_key,question,source,sitting from artist_interview_answers where artist_id=${config.artistId}::uuid order by offered_at,id`,
      );
      const questions = rows.map(row => ({
        entryId: `answer:${row.id}`,
        revision: knowledgeRevision(row),
        questionKey: row.question_key,
        answerState:
          row.source === "offered" ? "offered" : row.source === "skipped" ? "skipped" : "answered",
        sitting: row.sitting,
        question: row.question,
      }));
      if (JSON.stringify(questions).length > 16000)
        throw new Error("Prior questions exceed their model context budget");
      signal?.throwIfAborted();
      return questions;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
