import { sql } from "drizzle-orm";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";
import type { TransactionDb } from "@/lib/ownership/types";
import type { ResearchOriginal } from "@/lib/questionResearch/types";

/** All published public answers, read in the caller's public-evidence snapshot.
 * Interview sessions, unpublished onboarding and private correction history are excluded.
 * Keep the question labelled separately: its premises are not artist statements.
 */
export async function loadPublicLatestOriginals(
  tx: TransactionDb,
  artistId: string,
): Promise<ResearchOriginal[]> {
  const scope = sql`select a.id,a.question,a.answer,a.created_at from artist_interview_answers a
    where a.artist_id=${artistId}::uuid
      and (a.source='followup' or (a.source='onboarding' and exists(
        select 1 from artist_onboarding_steps p where p.artist_id=a.artist_id and p.step='publish')))
      and a.answer is not null and length(trim(a.answer)) > 0`;
  // Check volume before transferring full answer bodies. The caller keeps this
  // and the row read in its repeatable-read public-evidence snapshot.
  const [size] = await tx.execute<{ n: number; chars: number }>(sql`
    with public_answers as (${scope})
    select count(*)::int as n,
      coalesce(sum(char_length(coalesce(question,''))+char_length(answer)),0)::bigint as chars
    from public_answers`);
  if (!size) throw new Error("Public answer corpus unavailable");
  if (Number(size.n) > MAX_KNOWLEDGE_ROWS || Number(size.chars) > MAX_KNOWLEDGE_CHARS)
    throw new KnowledgeError(
      "corpus_too_large",
      413,
      "Public answers exceed the supported snapshot size",
    );
  const rows = await tx.execute<{
    id: string;
    question: string;
    answer: string;
    created_at: string | Date | null;
  }>(sql`${scope} order by a.created_at desc nulls last,a.id limit ${MAX_KNOWLEDGE_ROWS + 1}`);
  const originals: ResearchOriginal[] = rows.map(row => {
    const publishedAt = row.created_at === null ? null : new Date(row.created_at).toISOString();
    const text = `Response saved/updated: ${publishedAt ?? "unknown"}. This is not the date of events described.\nPublished interview question: ${row.question}\nArtist response:\n${row.answer}`;
    return {
      sourceId: `public_answer:${row.id}`,
      revision: knowledgeRevision({ id: row.id, text, publishedAt }),
      text,
      url: `https://musicnerd.net/artist/${artistId}`,
      curation: "approved",
      evidenceKind: "original_text",
      speaker: "unverified",
      publishedAt,
      retrievedAt: null,
      truncated: false,
    };
  });
  // Include labels/date context and UTF-16 length in the same aggregate corpus
  // budget as the other originals. A limit is an explicit failure, never absence.
  if (
    originals.length > MAX_KNOWLEDGE_ROWS ||
    originals.reduce((sum, o) => sum + o.text.length, 0) > MAX_KNOWLEDGE_CHARS
  )
    throw new KnowledgeError(
      "corpus_too_large",
      413,
      "Public answers exceed the supported snapshot size",
    );
  return originals;
}
