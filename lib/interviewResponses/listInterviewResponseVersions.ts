import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistInterviewAnswers } from "@/lib/db/schema";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { loadInterviewResponseVersions } from "./loadInterviewResponseVersions";
import { pageInterviewResponses } from "./pageInterviewResponses";
import type { ResponseQuery } from "./types";

/** Page the actual retained versions, reporting missing history rather than reconstructing it. */
export async function listInterviewResponseVersions(
  artistId: string,
  userId: string,
  answerId: string,
  query: ResponseQuery,
) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      const [row] = await tx
        .select()
        .from(artistInterviewAnswers)
        .where(
          and(
            eq(artistInterviewAnswers.artistId, artistId),
            eq(artistInterviewAnswers.id, answerId),
          ),
        )
        .limit(1);
      if (!row) throw new KnowledgeError("not_found", 404, "Saved response unavailable");
      const page = pageInterviewResponses(
        await loadInterviewResponseVersions(tx, row),
        [artistId, answerId, "versions"],
        query,
      );
      return { status: "ok" as const, versions: page.items, nextCursor: page.nextCursor };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
