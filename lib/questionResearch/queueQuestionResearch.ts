import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { researchRequestKey } from "@/lib/questionResearch/researchRequestKey";
import { researchStatusMessage } from "@/lib/questionResearch/researchStatusMessage";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";
import {
  QUESTION_RESEARCH_DAILY_ARTIST,
  QUESTION_RESEARCH_DAILY_GLOBAL,
  QUESTION_RESEARCH_CACHE_MS,
  type ResearchRequest,
  type ResearchAuth,
  type QuestionResearchState,
} from "@/lib/questionResearch/types";

/** Reserve a durable global/artist budget and acknowledge without starting provider work. */
export async function queueQuestionResearch(
  artistId: string,
  auth: ResearchAuth,
  input: ResearchRequest,
) {
  const request = validateQuestionResearchBody(input),
    key = researchRequestKey(request);
  return db.transaction(async tx => {
    // All enqueue paths take this lock before the artist lock: quotas work across workers.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('musicnerd-question-research-budget'))`,
    );
    await lockArtistRow(tx, artistId);
    const [artist] = await tx.execute(sql`select id from artists where id=${artistId}::uuid`);
    if (!artist) throw new KnowledgeError("not_found", 404, "Artist unavailable");
    if (auth.kind === "artist") await authorizeArtistKnowledge(tx, artistId, auth.userId);
    const claim = await findApprovedClaim(tx, artistId);
    const previous = await tx.execute<{
      id: string;
      status: string;
      state: QuestionResearchState;
      updated_at: string;
    }>(
      sql`select id,status,state,updated_at from artist_research_jobs where artist_id=${artistId}::uuid and kind='question_research' and (status in ('pending','running') or (status='done' and updated_at>now()-${`${QUESTION_RESEARCH_CACHE_MS} milliseconds`}::interval)) order by created_at desc limit 10`,
    );
    const reusable = previous.find(
      j =>
        j.state.key === key &&
        (j.state.expectedClaimId ?? null) === (claim?.id ?? null) &&
        (j.status !== "done" ||
          j.state.stage === "complete" ||
          (j.state.stage === "unresolved" &&
            Date.now() - new Date(j.updated_at).getTime() < 5 * 60_000)),
    );
    if (reusable)
      return {
        status: "ok" as const,
        jobId: reusable.id,
        reused: true,
        stage: reusable.state.stage,
        message: researchStatusMessage(reusable.state.stage, reusable.state.plan?.provider ?? null),
        provider: reusable.state.plan?.provider ?? null,
        updatedAt: new Date(reusable.updated_at).toISOString(),
        references: [],
        limitations: ["Read current job status to obtain revalidated evidence."],
      };
    if (previous.some(j => ["pending", "running"].includes(j.status)))
      throw new KnowledgeError(
        "research_busy",
        429,
        "Another question is being researched for this artist; resume it or try later",
      );
    const [usage] = await tx.execute<{ global: number; artist: number }>(
      sql`select count(*)::int as global,count(*) filter(where artist_id=${artistId}::uuid)::int as artist from artist_research_jobs where kind='question_research' and created_at>now()-interval '24 hours'`,
    );
    if (!usage) throw new Error("Research budget unavailable");
    if (
      Number(usage.global) >= QUESTION_RESEARCH_DAILY_GLOBAL ||
      Number(usage.artist) >= QUESTION_RESEARCH_DAILY_ARTIST
    )
      throw new KnowledgeError(
        "research_quota",
        429,
        "Research budget reached; use saved evidence or try again later",
      );
    const state: QuestionResearchState = {
      version: 1,
      request,
      key,
      expectedClaimId: claim?.id ?? null,
      stage: "checking_saved",
      createdAt: new Date().toISOString(),
      references: [],
      limitations: [],
      modelCalls: 0,
      providerCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    const activityId = await recordArtistActivity(
      artistId,
      "question_research",
      {
        trigger: "question_research",
        ...(auth.kind === "artist" ? { userId: auth.userId } : { actorKind: "system" as const }),
      },
      tx,
    );
    const [job] = await tx.execute<{ id: string; updated_at: string }>(
      sql`insert into artist_research_jobs(artist_id,kind,state,activity_id) values(${artistId}::uuid,'question_research',${JSON.stringify(state)}::jsonb,${activityId}::uuid) returning id,updated_at`,
    );
    if (!job) throw new Error("Research acknowledgement was not persisted");
    return {
      status: "ok" as const,
      jobId: job.id,
      reused: false,
      stage: state.stage,
      message: researchStatusMessage(state.stage, null),
      provider: null,
      updatedAt: new Date(job.updated_at).toISOString(),
      references: [],
      limitations: [],
    };
  });
}
