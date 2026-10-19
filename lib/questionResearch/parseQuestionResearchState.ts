import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";
import { z } from "zod";
import {
  SAVED_RESEARCH_MODEL_STEPS,
  type QuestionResearchState,
  type ResearchFacetCoverage,
} from "@/lib/questionResearch/types";
const explorationSchema = z.strictObject({
  eligibleSources: z.number().int().min(0).max(5000),
  toolCalls: z.number().int().min(0).max(12),
  readChars: z.number().int().min(0).max(24000),
  calls: z.array(z.enum(["browse", "search", "read", "finish", "lookup", "unresolved"])).max(12),
  readSourceIds: z.array(z.string().max(200)).max(72),
  rejectedIdCount: z.number().int().min(0).max(72),
  stopReason: z.enum(["supported", "outside_lookup", "insufficient", "incomplete"]),
});
const facetCoverageSchema = z
  .array(
    z.strictObject({
      id: z.enum(["f1", "f2", "f3", "f4"]),
      referenceIndexes: z.array(z.number().int().min(0).max(5)).max(6),
    }),
  )
  .max(4);
/** Reject malformed persisted work before it can choose a provider or exceed a saved budget. */
export function parseQuestionResearchState(value: unknown): QuestionResearchState {
  if (!value || typeof value !== "object" || JSON.stringify(value).length > 400000)
    throw new Error("Invalid research state");
  const s = value as QuestionResearchState;
  const coverageValid = (coverage: ResearchFacetCoverage | undefined) => {
    if (coverage === undefined) return true;
    if (!facetCoverageSchema.safeParse(coverage).success || !Array.isArray(s.references))
      return false;
    const facets = s.request?.evidenceFacets;
    return Boolean(
      Array.isArray(facets) &&
      coverage.length === facets.length &&
      coverage.every((row, rowIndex) => {
        const indexes = row.referenceIndexes;
        return (
          row.id === facets[rowIndex]?.id &&
          Array.isArray(indexes) &&
          indexes.length <= 6 &&
          indexes.every(
            (index, i) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < s.references.length &&
              indexes.indexOf(index) === i,
          )
        );
      }),
    );
  };
  if (
    s.version !== 1 ||
    (s.budgetVersion !== undefined && s.budgetVersion !== 2) ||
    (s.outsideReservedAt !== undefined &&
      (s.budgetVersion !== 2 ||
        typeof s.outsideReservedAt !== "string" ||
        !Number.isFinite(Date.parse(s.outsideReservedAt)) ||
        s.savedOnly === true)) ||
    (s.budgetVersion === 2 &&
      !s.outsideReservedAt &&
      ((s.step !== undefined && s.step !== "saved") ||
        s.providerCalls > 0 ||
        (s.inFlight !== undefined && s.inFlight !== "model"))) ||
    (s.outsideQuota !== undefined &&
      (s.budgetVersion !== 2 ||
        !s.savedOnly ||
        !["outside_artist", "outside_global"].includes(s.outsideQuota.quotaScope) ||
        !Number.isInteger(s.outsideQuota.retryAfterSeconds) ||
        s.outsideQuota.retryAfterSeconds < 0 ||
        s.outsideQuota.retryAfterSeconds > 86400 ||
        !Number.isFinite(Date.parse(s.outsideQuota.resetAt)))) ||
    (s.selection !== undefined && !["candidates", "research"].includes(s.selection)) ||
    (s.directAttempted !== undefined && s.directAttempted !== true) ||
    (s.selection !== undefined) !== (s.directAttempted === true) ||
    (s.selection === "candidates" &&
      (s.stage !== "complete" ||
        s.modelCalls !== 0 ||
        s.providerCalls !== 0 ||
        s.plan !== undefined ||
        s.outsideReservedAt !== undefined ||
        s.inFlight !== undefined)) ||
    (s.exploration !== undefined && !explorationSchema.safeParse(s.exploration).success) ||
    !coverageValid(s.facetCoverage) ||
    (s.outputRetries !== undefined &&
      (!Number.isInteger(s.outputRetries) ||
        s.outputRetries < 0 ||
        s.outputRetries > 1 ||
        s.modelCalls < s.outputRetries)) ||
    (s.savedOnly !== undefined && typeof s.savedOnly !== "boolean") ||
    (s.savedOnly === true &&
      ((s.step !== undefined && s.step !== "saved") ||
        s.plan !== undefined ||
        s.providerCalls !== 0 ||
        s.modelCalls > SAVED_RESEARCH_MODEL_STEPS + (s.outputRetries ?? 0) ||
        (s.inFlight !== undefined && s.inFlight !== "model"))) ||
    typeof s.key !== "string" ||
    !Number.isFinite(Date.parse(s.createdAt)) ||
    !(s.expectedClaimId === null || typeof s.expectedClaimId === "string") ||
    ![
      "checking_saved",
      "searching",
      "reading",
      "transcribing",
      "waiting_provider",
      "complete",
      "unresolved",
      "failed",
      "cancelled",
    ].includes(s.stage) ||
    !Array.isArray(s.references) ||
    s.references.length > 6 ||
    !Array.isArray(s.limitations) ||
    s.limitations.length > 30 ||
    !Number.isInteger(s.modelCalls) ||
    s.modelCalls < 0 ||
    s.modelCalls > SAVED_RESEARCH_MODEL_STEPS + 1 + (s.outputRetries ?? 0) ||
    !Number.isInteger(s.providerCalls) ||
    s.providerCalls < 0 ||
    s.providerCalls > 16 ||
    (s.candidates && s.candidates.length > 3) ||
    (s.originals && s.originals.length > 3) ||
    (s.nextCandidate !== undefined &&
      (!Number.isInteger(s.nextCandidate) || s.nextCandidate < 0 || s.nextCandidate > 3)) ||
    (s.runId && !/^[a-zA-Z0-9_-]{1,100}$/.test(s.runId)) ||
    (s.nextPollAt !== undefined && !Number.isFinite(Date.parse(s.nextPollAt))) ||
    (s.datasetId && !/^[a-zA-Z0-9_-]{1,100}$/.test(s.datasetId))
  )
    throw new Error("Invalid research state");
  if (
    s.step &&
    ![
      "saved",
      "search",
      "pages",
      "social_start",
      "social_poll",
      "social_collect",
      "assess",
    ].includes(s.step)
  )
    throw new Error("Invalid research stage");
  return { ...s, request: validateQuestionResearchBody(s.request) };
}
