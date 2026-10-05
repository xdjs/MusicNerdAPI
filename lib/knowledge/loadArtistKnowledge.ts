import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import {
  artists,
  users,
  artistClaims,
  artistVaultSources,
  artistSocialPosts,
  artistDocs,
  artistInterviewAnswers,
  artistDocCorrections,
  artistResearchJobs,
} from "@/lib/db/schema";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";

/** Reauthorizes the verified caller and reads one bounded, read-only DB snapshot. */
export async function loadArtistKnowledge(artistId: string, userId: string) {
  return db.transaction(
    async tx => {
      const [user] = await tx
        .select({ id: users.id, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) throw new KnowledgeError("unauthenticated", 401, "Not signed in");
      if (!user.isAdmin) {
        const [claim] = await tx
          .select({ id: artistClaims.id })
          .from(artistClaims)
          .where(
            and(
              eq(artistClaims.artistId, artistId),
              eq(artistClaims.userId, userId),
              eq(artistClaims.status, "approved"),
            ),
          )
          .limit(1);
        if (!claim)
          throw new KnowledgeError("forbidden", 403, "Artist claimant or administrator required");
      }
      const [artist] = await tx
        .select({ id: artists.id, name: artists.name, bio: artists.bio })
        .from(artists)
        .where(eq(artists.id, artistId))
        .limit(1);
      if (!artist) throw new KnowledgeError("not_found", 404, "Artist unavailable");
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
