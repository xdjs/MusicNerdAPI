import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistInterviewAnswers } from "@/lib/db/schema";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { loadInterviewResponseVersions } from "./loadInterviewResponseVersions";
import { toInterviewResponse } from "./toInterviewResponse";
import type { ResponseQuery } from "./types";

/** Resolve a current or exact retained response under current artist authorization. */
export async function readInterviewResponse(
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
      const current = toInterviewResponse(row);
      if (!query.revision || query.revision === current.revision)
        return { status: "ok" as const, response: current, isCurrent: true };
      const retained = (await loadInterviewResponseVersions(tx, row)).find(
        version => version.response.revision === query.revision,
      );
      if (!retained)
        throw new KnowledgeError("not_found", 404, "Requested response revision unavailable");
      return { status: "ok" as const, response: retained.response, isCurrent: retained.isCurrent };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
