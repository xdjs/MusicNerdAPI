import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { parseQuestionResearchState } from "@/lib/questionResearch/parseQuestionResearchState";
import { getQuestionResearchStatus } from "@/lib/questionResearch/getQuestionResearchStatus";
import { QUESTION_RESEARCH_LIFETIME_MS, type ResearchAuth } from "@/lib/questionResearch/types";

/** Continue one admitted candidate job without resetting its identity, lifetime or spending limits. */
export async function continueQuestionResearch(
  artistId: string,
  jobId: string,
  auth: ResearchAuth,
) {
  if (auth.kind !== "service")
    throw new KnowledgeError("forbidden", 403, "Continuation requires a service credential");
  await db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    const [row] = await tx.execute<{ state: unknown; status: string }>(sql`
      select state,status from artist_research_jobs
      where artist_id=${artistId}::uuid and id=${jobId}::uuid and kind='question_research'
      for update`);
    if (!row) throw new KnowledgeError("not_found", 404, "Research job unavailable");
    const state = parseQuestionResearchState(row.state);
    const claim = await findApprovedClaim(tx, artistId);
    if ((claim?.id ?? null) !== state.expectedClaimId)
      throw new KnowledgeError("research_cancelled", 409, "Artist ownership changed");
    if (!state.directAttempted)
      throw new KnowledgeError("invalid_transition", 409, "This job has no candidate attempt");
    // Duplicate continuation must not clear a running or completed research result.
    if (state.selection === "research") return;
    if (Date.now() - Date.parse(state.createdAt) > QUESTION_RESEARCH_LIFETIME_MS)
      throw new KnowledgeError("research_expired", 410, "The original research job expired");
    if (state.selection !== "candidates" || state.stage !== "complete" || row.status !== "done")
      throw new KnowledgeError("invalid_transition", 409, "Candidate research is unavailable");
    const [busy] = await tx.execute(sql`
      select id from artist_research_jobs where artist_id=${artistId}::uuid
        and kind='question_research' and status in ('pending','running') and id<>${jobId}::uuid
      limit 1`);
    if (busy)
      throw new KnowledgeError(
        "research_busy",
        429,
        "Another question is being researched for this artist",
      );
    state.selection = "research";
    state.stage = "checking_saved";
    state.step = "saved";
    state.references = [];
    await tx.execute(sql`
      update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,
        status='pending',claimed_at=null,updated_at=clock_timestamp()
      where artist_id=${artistId}::uuid and id=${jobId}::uuid and kind='question_research'`);
  });
  return getQuestionResearchStatus(artistId, jobId, auth);
}
