import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { readKnowledgeInTransaction } from "@/lib/knowledge/readKnowledgeInTransaction";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { toInterviewQuestion } from "./toInterviewQuestion";
import type { OfferReference, QuestionRow } from "./types";
/** Reopen exact authorized evidence under row locks; a search hit or generated summary cannot support an offer. */
export async function validateInterviewOfferReferences(
  tx: TransactionDb,
  artistId: string,
  userId: string,
  references: OfferReference[],
) {
  const changed = () =>
    new KnowledgeError(
      "revision_changed",
      409,
      "Interview evidence changed; read the original again",
    );
  for (const ref of references) {
    if (ref.end - ref.start !== ref.quote.length) throw changed();
    if (ref.kind === "answer") {
      const [row] = await tx.execute<QuestionRow>(
        sql`select * from artist_interview_answers where artist_id=${artistId}::uuid and id=${ref.entryId.slice(7)}::uuid and answer is not null for share`,
      );
      if (
        !row ||
        toInterviewQuestion(row).revision !== ref.revision ||
        row.answer?.slice(ref.start, ref.end) !== ref.quote
      )
        throw changed();
    } else {
      const table = sql.identifier(
        ref.sourceId.startsWith("vault:") ? "artist_vault_sources" : "artist_social_posts",
      );
      const [row] = await tx.execute<{ id: string }>(
        sql`select id from ${table} where artist_id=${artistId}::uuid and id=${ref.sourceId.split(":")[1]}::uuid for share`,
      );
      if (!row) throw new KnowledgeError("not_found", 404, "Original source unavailable");
      const original = await readKnowledgeInTransaction(tx, artistId, userId, {
        operation: "read",
        sourceId: ref.sourceId,
        revision: ref.revision,
        start: ref.start,
        maxChars: Math.max(1000, ref.quote.length),
        includeVersion: true,
      });
      if (
        original.passage.start !== ref.start ||
        original.passage.text.slice(0, ref.quote.length) !== ref.quote
      )
        throw changed();
    }
  }
}
