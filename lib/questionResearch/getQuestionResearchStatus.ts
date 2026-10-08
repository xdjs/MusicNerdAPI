import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { parseQuestionResearchState } from "@/lib/questionResearch/parseQuestionResearchState";
import { researchStatusMessage } from "@/lib/questionResearch/researchStatusMessage";
import {
  QUESTION_RESEARCH_LIFETIME_MS,
  type ResearchAuth,
  type ResearchStage,
} from "@/lib/questionResearch/types";

/** Never return job scratch, raw queries, private memory or an ineligible stored reference. */
export async function getQuestionResearchStatus(
  artistId: string,
  jobId: string,
  auth: ResearchAuth,
) {
  if (auth.kind === "artist") await authorizeArtistKnowledge(db, artistId, auth.userId);
  const [row] = await db.execute<{ state: unknown; status: string; updated_at: string }>(
    sql`select state,status,updated_at from artist_research_jobs where artist_id=${artistId}::uuid and id=${jobId}::uuid and kind='question_research'`,
  );
  if (!row) throw new KnowledgeError("not_found", 404, "Research job unavailable");
  const state = parseQuestionResearchState(row.state);
  const claim = await findApprovedClaim(db, artistId);
  let stage: ResearchStage = state.stage;
  if ((claim?.id ?? null) !== state.expectedClaimId) stage = "cancelled";
  else if (
    row.status === "failed" ||
    (Date.now() - Date.parse(state.createdAt) > QUESTION_RESEARCH_LIFETIME_MS &&
      ["pending", "running"].includes(row.status))
  )
    stage = "failed";
  else if (row.status === "done" && !["complete", "unresolved", "cancelled"].includes(stage))
    stage = "cancelled";
  const eligible = ["complete", "unresolved"].includes(stage)
    ? await loadPublicResearchOriginals(artistId)
    : [];
  const references = state.references.flatMap(r => {
    const current = eligible.find(e => e.sourceId === r.sourceId && e.revision === r.revision);
    if (
      !current ||
      r.start < 0 ||
      r.end > current.text.length ||
      current.text.slice(r.start, r.end) !== r.text
    )
      return [];
    return [{ ...r, curation: current.curation }];
  });
  const limitations = [...state.limitations];
  if (stage === "complete" && !references.length) {
    stage = "unresolved";
    limitations.push(
      "Supporting evidence changed or became unavailable; read current sources before answering.",
    );
  }
  return {
    status: "ok" as const,
    jobId,
    stage,
    provider: state.plan?.provider ?? null,
    message: researchStatusMessage(stage, state.plan?.provider ?? null),
    updatedAt: new Date(row.updated_at).toISOString(),
    references,
    limitations,
  };
}
