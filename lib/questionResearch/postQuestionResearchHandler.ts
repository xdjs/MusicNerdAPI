import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { queueQuestionResearch } from "@/lib/questionResearch/queueQuestionResearch";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { queueDirectEvidenceResearch } from "@/lib/questionResearch/queueDirectEvidenceResearch";
/** Acknowledge a persisted request; all model/provider work belongs to the durable worker. */
export async function postQuestionResearchHandler(request: Request, artistId: string) {
  return withResearchRequest(
    request,
    artistId,
    false,
    async auth => {
      let value: unknown;
      try {
        const body = await request.text();
        if (body.length > 4096) throw new Error();
        value = JSON.parse(body);
      } catch {
        throw new KnowledgeError("invalid_request", 400, "Invalid bounded research request");
      }
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new KnowledgeError("invalid_request", 400, "Invalid bounded research request");
      const { preferDirectEvidence, ...neutral } = value as Record<string, unknown>;
      if (preferDirectEvidence !== undefined && typeof preferDirectEvidence !== "boolean")
        throw new KnowledgeError("invalid_request", 400, "Invalid direct evidence preference");
      const routing = validateQuestionResearchBody(neutral);
      if (!preferDirectEvidence) return queueQuestionResearch(artistId, auth, routing);
      if (auth.kind !== "service")
        throw new KnowledgeError("forbidden", 403, "Direct evidence requires a service credential");
      return queueDirectEvidenceResearch(artistId, routing);
    },
    202,
  );
}
