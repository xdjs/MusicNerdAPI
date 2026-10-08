import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistInterviewAnswers } from "@/lib/db/schema";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { assertInterviewResponseBudget } from "./assertInterviewResponseBudget";
import { pageInterviewResponses } from "./pageInterviewResponses";
import { toInterviewResponse } from "./toInterviewResponse";
import type { ResponseQuery } from "./types";

/** Read exact answered questions, independently of the interview-generation feature. */
export async function listInterviewResponses(
  artistId: string,
  userId: string,
  query: ResponseQuery,
) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      await assertInterviewResponseBudget(tx, artistId);
      const rows = await tx
        .select()
        .from(artistInterviewAnswers)
        .where(
          and(
            eq(artistInterviewAnswers.artistId, artistId),
            isNotNull(artistInterviewAnswers.answer),
            sql`btrim(${artistInterviewAnswers.answer}) <> ''`,
          ),
        )
        .orderBy(desc(artistInterviewAnswers.offeredAt), desc(artistInterviewAnswers.id));
      const page = pageInterviewResponses(
        rows.map(toInterviewResponse),
        [artistId, "responses"],
        query,
      );
      return { status: "ok" as const, responses: page.items, nextCursor: page.nextCursor };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
