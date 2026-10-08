import { sql } from "drizzle-orm";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { TransactionDb } from "@/lib/ownership/types";

/** Bound the database read before loading exact private text; never truncate it silently. */
export async function assertInterviewResponseBudget(
  tx: TransactionDb,
  artistId: string,
  answerId?: string,
) {
  const [size] = await tx.execute<{ n: number; chars: string }>(
    answerId
      ? sql`select count(*)::int as n,coalesce(sum(char_length(snapshot::text)),0)::text as chars from artist_interview_answer_versions where artist_id=${artistId}::uuid and answer_id=${answerId}::uuid`
      : sql`select count(*)::int as n,coalesce(sum(char_length(question)+char_length(answer)),0)::text as chars from artist_interview_answers where artist_id=${artistId}::uuid and answer is not null`,
  );
  if (!size || size.n > 2000 || Number(size.chars) > 1000000)
    throw new KnowledgeError(
      "history_too_large",
      413,
      "Response history exceeds the supported size",
    );
}
