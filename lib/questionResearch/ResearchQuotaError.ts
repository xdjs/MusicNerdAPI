import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { ResearchQuota } from "./types";
/** Safe shared-budget failure with a real rolling-window boundary. */
export class ResearchQuotaError extends KnowledgeError {
  constructor(public readonly quota: ResearchQuota) {
    super(
      quota.quotaScope === "saved_global" ? "saved_evidence_quota" : "outside_research_quota",
      429,
      quota.quotaScope === "saved_global"
        ? "Saved-source questions are temporarily at capacity. Try again after the shared limit resets."
        : "Outside research is temporarily at capacity. Saved-source answers remain available.",
    );
  }
}
