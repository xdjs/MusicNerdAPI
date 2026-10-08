import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { queueQuestionResearch } from "@/lib/questionResearch/queueQuestionResearch";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
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
      return queueQuestionResearch(artistId, auth, validateQuestionResearchBody(value));
    },
    202,
  );
}
