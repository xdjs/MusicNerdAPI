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
  SAVED_EVIDENCE_DAILY_ARTIST,
  SAVED_EVIDENCE_DAILY_GLOBAL,
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
    // Match the request before limiting: unrelated newer rows must not hide a reusable job.
    const [reusable] = await tx.execute<{
      id: string;
      status: string;
      state: QuestionResearchState;
      updated_at: string;
    }>(sql`select id,status,state,updated_at from artist_research_jobs
      where artist_id=${artistId}::uuid and kind='question_research'
        and state->>'key'=${key}
        and state->>'expectedClaimId' is not distinct from ${claim?.id ?? null}::text
        and (status in ('pending','running') or
          (status='done' and updated_at>now()-${`${QUESTION_RESEARCH_CACHE_MS} milliseconds`}::interval
            and (state->>'stage'='complete' or
              (state->>'stage'='unresolved' and updated_at>now()-interval '5 minutes'))))
      order by created_at desc limit 1`);
    if (reusable)
      return {
        status: "ok" as const,
        jobId: reusable.id,
        reused: true,
        ...(reusable.state.savedOnly ? { outsideResearchReason: "quota" as const } : {}),
        stage: reusable.state.stage,
        message: researchStatusMessage(reusable.state.stage, reusable.state.plan?.provider ?? null),
        provider: reusable.state.plan?.provider ?? null,
        updatedAt: new Date(reusable.updated_at).toISOString(),
        references: [],
        limitations: ["Read current job status to obtain revalidated evidence."],
      };
    const [busy] = await tx.execute(sql`select id from artist_research_jobs
      where artist_id=${artistId}::uuid and kind='question_research'
        and status in ('pending','running') limit 1`);
    if (busy)
      throw new KnowledgeError(
        "research_busy",
        429,
        "Another question is being researched for this artist; resume it or try later",
      );
    const [usage] = await tx.execute<{
      global: number;
      artist: number;
      saved_global: number;
      saved_artist: number;
    }>(sql`select
      count(*) filter(where state->'savedOnly' is distinct from 'true'::jsonb)::int as global,
      count(*) filter(where artist_id=${artistId}::uuid and state->'savedOnly' is distinct from 'true'::jsonb)::int as artist,
      count(*) filter(where state->'savedOnly'='true'::jsonb)::int as saved_global,
      count(*) filter(where artist_id=${artistId}::uuid and state->'savedOnly'='true'::jsonb)::int as saved_artist
      from artist_research_jobs where kind='question_research' and created_at>now()-interval '24 hours'`);
    if (
      !usage ||
      ![usage.global, usage.artist, usage.saved_global, usage.saved_artist].every(
        v => Number.isInteger(Number(v)) && Number(v) >= 0,
      )
    )
      throw new Error("Research budget unavailable");
    const savedOnly =
      Number(usage.global) >= QUESTION_RESEARCH_DAILY_GLOBAL ||
      Number(usage.artist) >= QUESTION_RESEARCH_DAILY_ARTIST;
    if (
      savedOnly &&
      (Number(usage.saved_global) >= SAVED_EVIDENCE_DAILY_GLOBAL ||
        Number(usage.saved_artist) >= SAVED_EVIDENCE_DAILY_ARTIST)
    )
      throw new KnowledgeError(
        "saved_evidence_quota",
        429,
        "Saved-evidence answer limit reached; try again later",
      );
    const state: QuestionResearchState = {
      version: 1,
      ...(savedOnly ? { savedOnly: true } : {}),
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
      ...(savedOnly ? { outsideResearchReason: "quota" as const } : {}),
      stage: state.stage,
      message: researchStatusMessage(state.stage, null),
      provider: null,
      updatedAt: new Date(job.updated_at).toISOString(),
      references: [],
      limitations: [],
    };
  });
}
