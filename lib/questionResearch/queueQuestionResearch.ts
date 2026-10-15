import { getQuestionResearchBudget } from "./getQuestionResearchBudget";
import { ResearchQuotaError } from "./ResearchQuotaError";
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
  QUESTION_RESEARCH_CACHE_MS,
  QUESTION_RESEARCH_LIFETIME_MS,
  type ResearchRequest,
  type ResearchAuth,
  type QuestionResearchState,
  type ResearchReference,
} from "@/lib/questionResearch/types";

/** Reserve global saved-question admission; outside capacity is reserved only at collection transition. */
export async function queueQuestionResearch(
  artistId: string,
  auth: ResearchAuth,
  input: ResearchRequest,
  options?: { directCandidates: ResearchReference[] },
) {
  if (options && auth.kind !== "service")
    throw new KnowledgeError("forbidden", 403, "Direct evidence requires a service credential");
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
        and (${options !== undefined} or state->>'selection' is distinct from 'candidates')
        and (state->>'selection' is distinct from 'candidates' or
          (state->>'createdAt')::timestamptz>now()-${`${QUESTION_RESEARCH_LIFETIME_MS} milliseconds`}::interval)
        and state->>'expectedClaimId' is not distinct from ${claim?.id ?? null}::text
        and (status in ('pending','running') or
          (status='done' and updated_at>now()-${`${QUESTION_RESEARCH_CACHE_MS} milliseconds`}::interval
            and (state->>'stage'='complete' or
              (state->>'stage'='unresolved' and updated_at>now()-interval '5 minutes'
                and (state->'outsideQuota' is null or (state->'outsideQuota'->>'resetAt')::timestamptz>now())))))
      order by created_at desc limit 1`);
    if (reusable)
      return {
        status: "ok" as const,
        jobId: reusable.id,
        reused: true,
        ...(reusable.state.selection ? { selection: reusable.state.selection } : {}),
        ...(reusable.state.savedOnly ? { outsideResearchReason: "quota" as const } : {}),
        ...(reusable.state.outsideQuota
          ? {
              ...reusable.state.outsideQuota,
              retryAfterSeconds: Math.max(
                0,
                Math.ceil((Date.parse(reusable.state.outsideQuota.resetAt) - Date.now()) / 1000),
              ),
            }
          : {}),
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
    const budget = await getQuestionResearchBudget(tx, artistId);
    if (budget.saved) throw new ResearchQuotaError(budget.saved);
    const hasCandidates = Boolean(options?.directCandidates.length);
    const state: QuestionResearchState = {
      version: 1,
      budgetVersion: 2,
      ...(options
        ? {
            selection: hasCandidates ? ("candidates" as const) : ("research" as const),
            directAttempted: true as const,
          }
        : {}),
      request,
      key,
      expectedClaimId: claim?.id ?? null,
      stage: hasCandidates ? "complete" : "checking_saved",
      createdAt: new Date().toISOString(),
      references: options?.directCandidates ?? [],
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
      sql`insert into artist_research_jobs(artist_id,kind,state,activity_id,status) values(${artistId}::uuid,'question_research',${JSON.stringify(state)}::jsonb,${activityId}::uuid,${hasCandidates ? "done" : "pending"}) returning id,updated_at`,
    );
    if (!job) throw new Error("Research acknowledgement was not persisted");
    return {
      status: "ok" as const,
      jobId: job.id,
      reused: false,
      ...(state.selection ? { selection: state.selection } : {}),
      stage: state.stage,
      message: researchStatusMessage(state.stage, null),
      provider: null,
      updatedAt: new Date(job.updated_at).toISOString(),
      references: [],
      limitations: [],
    };
  });
}
