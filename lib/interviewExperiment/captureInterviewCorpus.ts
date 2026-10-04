import postgres from "postgres";
import { normalizeInterviewCorpus } from "@/lib/interviewExperiment/normalizeInterviewCorpus";
import type { InterviewCorpus } from "@/lib/interviewExperiment/types";

/** Read one artist under an explicitly selected environment and a read-only transaction.
 * @param artistId - Exact environment-specific artist id.
 * @param expectedHandle - Connected Instagram identity, checked before reading evidence.
 * @param connection - App-role database connection supplied by the operator.
 * @param environment - Environment recorded in the private corpus.
 * @returns The frozen evidence; rejects failed reads instead of turning them into missing data.
 */
export async function captureInterviewCorpus(
  artistId: string,
  expectedHandle: string,
  connection: string,
  environment: "production" | "staging",
): Promise<InterviewCorpus> {
  if (!/^[0-9a-f-]{36}$/i.test(artistId) || !expectedHandle.trim())
    throw new Error("Explicit artist id and connected handle required");
  const sql = postgres(connection, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    return await sql.begin("isolation level repeatable read read only", async tx => {
      const [identity] =
        await tx`select current_user as role, current_setting('transaction_read_only') as readonly`;
      if (identity.role !== "mnweb" || identity.readonly !== "on")
        throw new Error("Snapshot requires the mnweb app role and a read-only transaction");
      const [artist] = await tx<
        { id: string; name: string; instagram: string | null }[]
      >`select id,name,instagram from artists where id=${artistId}::uuid`;
      if (!artist || artist.instagram?.toLowerCase() !== expectedHandle.toLowerCase())
        throw new Error("Artist identity does not match the expected connected profile");
      const posts =
        await tx`select id,artist_id,platform,platform_post_id,owner_username,is_own_post,caption,url,posted_at,created_at,like_count,comment_count,play_count,hashtags,mentions,coauthors,music_title,music_artist,jsonb_build_object('_musicnerdTranscript',raw->'_musicnerdTranscript') as raw from artist_social_posts where artist_id=${artistId}::uuid order by posted_at desc nulls last,id`;
      const sources =
        await tx`select id,artist_id,url,title,snippet,status,file_path,extracted_text,published_at,created_at,updated_at from artist_vault_sources where artist_id=${artistId}::uuid and status='approved' order by created_at desc,id`;
      const answers =
        await tx`select id,artist_id,question,answer,created_at from artist_interview_answers where artist_id=${artistId}::uuid order by created_at,id`;
      const corrections =
        await tx`select id,artist_id,claim,correction,kind,created_at,updated_at from artist_doc_corrections where artist_id=${artistId}::uuid order by created_at,id`;
      const credits =
        await tx`select artist_id,kind,subject,is_handle,is_self,label,quote,source_url,posted_at from artist_social_credits where artist_id=${artistId}::uuid order by posted_at desc,id`;
      return {
        ...normalizeInterviewCorpus(
          { artist, posts, sources, answers, corrections, credits },
          new Date().toISOString(),
        ),
        environment,
      };
    });
  } finally {
    await sql.end();
  }
}
