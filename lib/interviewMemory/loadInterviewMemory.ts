import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import { toInterviewBoundary } from "@/lib/interviewMemory/toInterviewBoundary";
import type { BoundaryRow, MemoryEntry, MemorySnapshot } from "@/lib/interviewMemory/types";
/** Read mandatory private memory directly; no Lore scan, model call or relevance-based omissions. */
export async function loadInterviewMemory(
  artistId: string,
  userId: string,
  sitting: number,
): Promise<MemorySnapshot> {
  if (!Number.isInteger(sitting) || sitting < 1 || sitting > 2147483647)
    throw new KnowledgeError("invalid_input", 400, "Invalid interview sitting");
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      const [latestSitting] = await tx.execute<{ n: number }>(
        sql`select coalesce(max(coalesce(sitting,1)),0)::int as n from artist_interview_answers where artist_id=${artistId}::uuid`,
      );
      if (!latestSitting) throw new Error("Interview sitting unavailable");
      if (sitting < Math.max(1, latestSitting.n) || sitting > latestSitting.n + 1)
        throw new KnowledgeError(
          "sitting_changed",
          409,
          "Interview sitting changed; restore the current or next sitting",
        );
      const [size] = await tx.execute<{ n: number; chars: number }>(
        sql`with mandatory as (select char_length(question)+char_length(answer) as chars from (select question,answer from artist_interview_answers where artist_id=${artistId}::uuid and answer is not null order by created_at desc,id limit 1) a union all select char_length(claim)+char_length(coalesce(correction,'')) from artist_doc_corrections where artist_id=${artistId}::uuid union all select char_length(wording)+char_length(origin_question) from artist_interview_boundaries where artist_id=${artistId}::uuid and retracted_at is null and (scope='until_retracted' or sitting=${sitting})) select count(*)::int as n,coalesce(sum(chars),0)::bigint as chars from mandatory`,
      );
      if (!size) throw new Error("Mandatory memory unavailable");
      if (Number(size.n) > 5000 || Number(size.chars) > 4000000)
        throw new KnowledgeError(
          "memory_too_large",
          413,
          "Mandatory memory exceeds the supported snapshot size",
        );
      const answers = await tx.execute<{
        id: string;
        question_key: string;
        question: string;
        answer: string;
        sitting: number | null;
        offered_at: string | Date;
        created_at: string | Date;
        source: string;
      }>(
        sql`select id,question_key,question,answer,sitting,offered_at,created_at,source from artist_interview_answers where artist_id=${artistId}::uuid and answer is not null order by created_at desc,id limit 1`,
      );
      const corrections = await tx.execute<{
        id: string;
        claim: string;
        correction: string | null;
        kind: string;
        updated_at: string | Date;
        created_at: string | Date;
      }>(
        sql`select id,claim,correction,kind,updated_at,created_at from artist_doc_corrections where artist_id=${artistId}::uuid order by updated_at desc,id`,
      );
      const boundaries = await tx.execute<BoundaryRow>(
        sql`select * from artist_interview_boundaries where artist_id=${artistId}::uuid and retracted_at is null and (scope='until_retracted' or sitting=${sitting}) order by created_at,id`,
      );
      const entries: MemoryEntry[] = [];
      const add = (
        entry: Omit<MemoryEntry, "revision" | "fields">,
        fields: [string, string | null][],
      ) => {
        const complete = {
          ...entry,
          fields: fields.map(([name, text]) => ({
            name,
            text,
            start: 0,
            end: text?.length ?? 0,
            totalChars: text?.length ?? 0,
            complete: true,
          })),
        };
        entries.push({ ...complete, revision: knowledgeRevision(complete) });
      };
      const normalized = normalizeArtistKnowledge({
        artist: { id: artistId, name: null, bio: null },
        summary: null,
        vault: [],
        social: [],
        jobs: [],
        answers: answers.map(a => ({
          id: a.id,
          artistId,
          questionKey: a.question_key,
          question: a.question,
          answer: a.answer,
          source: a.source,
          sitting: a.sitting,
          offeredAt: new Date(a.offered_at).toISOString(),
          createdAt: new Date(a.created_at).toISOString(),
        })),
        corrections: corrections.map(c => ({
          id: c.id,
          artistId,
          claim: c.claim,
          correction: c.correction,
          kind: c.kind,
          createdAt: new Date(c.created_at).toISOString(),
          updatedAt: new Date(c.updated_at).toISOString(),
        })),
      });
      for (const kind of ["answer", "correction"])
        for (const entry of normalized.history.filter(e => e.kind === kind)) {
          entries.push({
            entryId: entry.entryId,
            revision: entry.revision,
            kind: entry.kind === "answer" ? "latest_answer" : "correction",
            fields: entry.fields.map(({ field, ...rest }) => ({ name: field, ...rest })),
            metadata: {
              questionKey: entry.questionKey,
              sitting: entry.sitting,
              offeredAt: entry.offeredAt,
              answerUpdatedAt: entry.answerUpdatedAt,
              source: entry.source,
              correctionKind: entry.correctionKind,
            },
          });
        }
      for (const row of boundaries) {
        const b = toInterviewBoundary(row);
        add(
          {
            entryId: `boundary:${b.id}`,
            kind: "boundary",
            metadata: {
              scope: b.scope,
              sitting: b.sitting,
              questionKey: b.questionKey,
              createdAt: b.createdAt,
              boundaryRevision: b.revision,
            },
          },
          [
            ["question", b.question],
            ["wording", b.wording],
          ],
        );
      }
      return { artistId, sitting, entries };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
