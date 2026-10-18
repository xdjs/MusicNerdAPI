import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeInterviewPreparation } from "./authorizeInterviewPreparation";
import { readPreparationScope } from "./readPreparationScope";
import type { ResearchJob } from "@/lib/research/types";
import type { PreparationState } from "./preparationTypes";
const claimStateSchema = z.object({
  version: z.literal(1),
  mode: z.literal("claim_preparation"),
  claimId: z.uuid(),
  userId: z.uuid(),
  createdAt: z.iso.datetime(),
});
/** Convert an approved-claim research handoff into private preparation, never an offered interview. */
export async function bootstrapClaimInterviewPreparation(job: ResearchJob): Promise<boolean> {
  const input = claimStateSchema.parse(job.state);
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    const [lease] = await tx.execute<{ id: string }>(
      sql`select id from artist_research_jobs where id=${job.id}::uuid and status='running' and updated_at is not distinct from ${job.updatedAt}::timestamptz for update`,
    );
    if (!lease) return false;
    const stop = async (reason: string) => {
      job.state = { ...input, stoppedReason: reason };
      await tx.execute(
        sql`update artist_research_jobs set state=${JSON.stringify(job.state)}::jsonb,status='failed',last_error=${reason},claimed_at=null,updated_at=clock_timestamp() where id=${job.id}::uuid`,
      );
      return false;
    };
    let claimId: string;
    try {
      claimId = await authorizeInterviewPreparation(tx, job.artistId, input.userId);
    } catch (error) {
      if (error instanceof KnowledgeError && [401, 403].includes(error.status))
        return stop("claim_preparation_not_authorized");
      throw error;
    }
    if (claimId !== input.claimId) return stop("claim_preparation_ownership_changed");
    const [readiness] = await tx.execute<{ busy: boolean; readable: boolean }>(
      sql`select exists(select 1 from artist_research_jobs where artist_id=${job.artistId}::uuid and kind in ('source_search','source_extract','social_ingest','caption_extract') and status in ('pending','running','queued')) as busy, (exists(select 1 from artist_vault_sources where artist_id=${job.artistId}::uuid and status='approved' and char_length(coalesce(extracted_text,''))>=80) or exists(select 1 from artist_social_posts where artist_id=${job.artistId}::uuid and is_own_post=true and char_length(coalesce(caption,''))>=80)) as readable`,
    );
    if (!readiness?.readable) {
      if (Date.now() - Date.parse(input.createdAt) >= 24 * 60 * 60 * 1000)
        return stop(
          readiness?.busy
            ? "claim_preparation_research_not_ready"
            : "claim_preparation_no_readable_originals",
        );
      const state = {
        ...input,
        nextAttemptAtMs: Date.now() + (readiness?.busy ? 60000 : 300000),
        waitingFor: readiness?.busy ? "research" : "originals",
      };
      await tx.execute(
        sql`update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,status='pending',attempts=0,claimed_at=null,updated_at=clock_timestamp() where id=${job.id}::uuid`,
      );
      return false;
    }
    const [existing] = await tx.execute<{ id: string; created_by: string }>(
      sql`select id,created_by from artist_interview_sessions where artist_id=${job.artistId}::uuid and state='active' limit 1`,
    );
    const [open] = await tx.execute<{ n: number }>(
      sql`select count(*)::int as n from artist_interview_answers where artist_id=${job.artistId}::uuid and source='offered'`,
    );
    if (open?.n || (existing && existing.created_by !== input.userId))
      return stop("existing_interview_requires_artist");
    let sessionId = existing?.id;
    if (!sessionId) {
      const [session] = await tx.execute<{ id: string }>(
        sql`insert into artist_interview_sessions(artist_id,request_id,sitting,created_by) select ${job.artistId}::uuid,${job.id}::uuid,greatest(coalesce((select max(sitting) from artist_interview_sessions where artist_id=${job.artistId}::uuid),0),coalesce((select max(sitting) from artist_interview_answers where artist_id=${job.artistId}::uuid),0))+1,${input.userId}::uuid returning id`,
      );
      if (!session) throw new Error("Private interview preparation unavailable");
      sessionId = session.id;
    }
    const scope = await readPreparationScope(tx, job.artistId, input.userId, sessionId);
    if (scope.ordinal > 3) return stop("existing_interview_requires_artist");
    const state: PreparationState = {
      version: 1,
      claimId,
      userId: input.userId,
      sessionId,
      sitting: scope.sitting,
      ordinal: scope.ordinal,
      totalCount: 4 - scope.ordinal,
      memorySnapshotId: scope.memorySnapshotId,
      stage: "preparing",
      cache: {},
      inFlight: false,
      createdAt: new Date().toISOString(),
    };
    const [saved] = await tx.execute<{ updated_at: string }>(
      sql`update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,updated_at=clock_timestamp() where id=${job.id}::uuid returning updated_at::text`,
    );
    if (!saved) throw new Error("Private interview preparation unavailable");
    job.state = state;
    job.updatedAt = saved.updated_at;
    return true;
  });
}
