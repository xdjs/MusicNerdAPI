import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { ResearchRequest } from "@/lib/questionResearch/types";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";

/** The bounds the research endpoint applied to the routing Web posted to it: at most 4096 characters, then the strict bounded request. In process, planner routing still crosses this check before anything is queued. */
export function parseResearchRouting(routing: Record<string, unknown>): ResearchRequest {
  if (JSON.stringify(routing).length > 4096)
    throw new KnowledgeError("invalid_request", 400, "Invalid bounded research request");
  return validateQuestionResearchBody(routing);
}
