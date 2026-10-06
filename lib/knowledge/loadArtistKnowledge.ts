import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import {
  artistVaultSources,
  artistSocialPosts,
  artistDocs,
  artistInterviewAnswers,
  artistDocCorrections,
  artistResearchJobs,
} from "@/lib/db/schema";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";

/** Reauthorizes the verified caller and reads one bounded, read-only DB snapshot. */
export async function loadArtistKnowledge(artistId: string, userId: string) {
  return db.transaction(
    async tx => {
      const artist = await authorizeArtistKnowledge(tx, artistId, userId);
      // Bound material in Postgres before transferring large text or JSON to the app.
      const sizes = await tx.execute<{ rows: number; chars: number }>(sql`
      select count(*)::int as rows, coalesce(sum(char_length(coalesce(extracted_text,'')) + char_length(coalesce(title,'')) + char_length(coalesce(snippet,'')) + char_length(url)),0)::bigint as chars
      from artist_vault_sources where artist_id = ${artistId} and status = 'approved'
      union all select count(*)::int, coalesce(sum(char_length(coalesce(caption,'')) + char_length(coalesce(raw->'_musicnerdTranscript'->>'text','')) + char_length(url)),0)::bigint
      from artist_social_posts where artist_id = ${artistId} and is_own_post = true
      union all select count(*)::int, coalesce(sum(char_length(question) + char_length(coalesce(answer,''))),0)::bigint
      from artist_interview_answers where artist_id = ${artistId}
      union all select count(*)::int, coalesce(sum(char_length(claim) + char_length(coalesce(correction,''))),0)::bigint
      from artist_doc_corrections where artist_id = ${artistId}
      union all select count(*)::int, 0::bigint from artist_research_jobs where artist_id = ${artistId}
      union all select count(*)::int, coalesce(sum(char_length(coalesce(lore_summary->>'text',''))),0)::bigint
      from artist_docs where artist_id = ${artistId}
    `);
      if (
        sizes.some(row => Number(row.rows) > MAX_KNOWLEDGE_ROWS) ||
        sizes.reduce((sum, row) => sum + Number(row.chars), 0) > MAX_KNOWLEDGE_CHARS
      )
        throw new KnowledgeError(
          "corpus_too_large",
          413,
          "Artist corpus exceeds the supported snapshot size",
        );
      const vaultQuery = tx
        .select({
          id: artistVaultSources.id,
          artistId: artistVaultSources.artistId,
          status: artistVaultSources.status,
          origin: artistVaultSources.origin,
          type: artistVaultSources.type,
          filePath: artistVaultSources.filePath,
          url: artistVaultSources.url,
          title: artistVaultSources.title,
          snippet: artistVaultSources.snippet,
          extractedText: artistVaultSources.extractedText,
          publishedAt: artistVaultSources.publishedAt,
          createdAt: artistVaultSources.createdAt,
          updatedAt: artistVaultSources.updatedAt,
        })
        .from(artistVaultSources)
        .where(
          and(eq(artistVaultSources.artistId, artistId), eq(artistVaultSources.status, "approved")),
        )
        .limit(MAX_KNOWLEDGE_ROWS + 1);
      const socialQuery = tx
        .select({
          id: artistSocialPosts.id,
          artistId: artistSocialPosts.artistId,
          platform: artistSocialPosts.platform,
          ownerUsername: artistSocialPosts.ownerUsername,
          isOwnPost: artistSocialPosts.isOwnPost,
          caption: artistSocialPosts.caption,
          url: artistSocialPosts.url,
          postedAt: artistSocialPosts.postedAt,
          transcript: sql<unknown>`jsonb_build_object('version', ${artistSocialPosts.raw}->'_musicnerdTranscript'->'version', 'actor', ${artistSocialPosts.raw}->'_musicnerdTranscript'->'actor', 'text', ${artistSocialPosts.raw}->'_musicnerdTranscript'->'text', 'fetchedAt', ${artistSocialPosts.raw}->'_musicnerdTranscript'->'fetchedAt')`,
          isRepost: sql<unknown>`${artistSocialPosts.raw}->'isRepost'`,
          isRetweet: sql<unknown>`${artistSocialPosts.raw}->'isRetweet'`,
        })
        .from(artistSocialPosts)
        .where(and(eq(artistSocialPosts.artistId, artistId), eq(artistSocialPosts.isOwnPost, true)))
        .limit(MAX_KNOWLEDGE_ROWS + 1);
      const answersQuery = tx
        .select()
        .from(artistInterviewAnswers)
        .where(eq(artistInterviewAnswers.artistId, artistId))
        .limit(MAX_KNOWLEDGE_ROWS + 1);
      const correctionsQuery = tx
        .select()
        .from(artistDocCorrections)
        .where(eq(artistDocCorrections.artistId, artistId))
        .limit(MAX_KNOWLEDGE_ROWS + 1);
      const jobsQuery = tx
        .select({
          id: artistResearchJobs.id,
          artistId: artistResearchJobs.artistId,
          kind: artistResearchJobs.kind,
          extractionOutcomes: sql<unknown>`case when ${artistResearchJobs.kind}='source_extract' then ${artistResearchJobs.state}->'outcomes' else null end`,
          status: artistResearchJobs.status,
          cursor: artistResearchJobs.cursor,
          total: artistResearchJobs.total,
          updatedAt: artistResearchJobs.updatedAt,
        })
        .from(artistResearchJobs)
        .where(eq(artistResearchJobs.artistId, artistId))
        .limit(MAX_KNOWLEDGE_ROWS + 1);
      const docQuery = tx
        .select({
          summary: sql<unknown>`jsonb_build_object('text', ${artistDocs.loreSummary}->'text')`,
        })
        .from(artistDocs)
        .where(eq(artistDocs.artistId, artistId))
        .limit(1);
      const [vault, social, answers, corrections, jobs, [doc]] = await Promise.all([
        vaultQuery,
        socialQuery,
        answersQuery,
        correctionsQuery,
        jobsQuery,
        docQuery,
      ]);
      return normalizeArtistKnowledge({
        artist,
        summary: doc?.summary ?? null,
        vault,
        social,
        answers,
        corrections,
        jobs,
      });
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
