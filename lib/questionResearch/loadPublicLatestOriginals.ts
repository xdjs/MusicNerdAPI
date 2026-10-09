import { sql } from "drizzle-orm";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import type { TransactionDb } from "@/lib/ownership/types";
import type { ResearchOriginal } from "@/lib/questionResearch/types";

/** Public answers displayed by Latest, read in the caller's public-evidence snapshot.
 * Interview sessions, unpublished onboarding and private correction history are excluded.
 * Keep the question labelled separately: its premises are not artist statements.
 */
export async function loadPublicLatestOriginals(
  tx: TransactionDb,
  artistId: string,
): Promise<ResearchOriginal[]> {
  const rows = await tx.execute<{
    id: string;
    question: string;
    answer: string;
    created_at: string | Date | null;
  }>(sql`select a.id,a.question,a.answer,a.created_at from artist_interview_answers a
    where a.artist_id=${artistId}::uuid
      and (a.source='followup' or (a.source='onboarding' and exists(
        select 1 from artist_onboarding_steps p where p.artist_id=a.artist_id and p.step='publish')))
      and a.answer is not null and length(trim(a.answer)) > 0
    order by a.created_at desc nulls last,a.id limit 6`);
  return rows.map(row => {
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
}
