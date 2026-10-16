import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { continueQuestionResearch } from "@/lib/questionResearch/continueQuestionResearch";

/** Service-only continuation accepts a job identity, never a replacement plan or spending override. */
export async function postContinueQuestionResearchHandler(
  request: Request,
  artistId: string,
  jobId: string,
) {
  return withResearchRequest(
    request,
    artistId,
    false,
    async auth => {
      if (auth.kind !== "service")
        throw new KnowledgeError("forbidden", 403, "Continuation requires a service credential");
      if (!z.uuid().safeParse(jobId).success)
        throw new KnowledgeError("invalid_request", 400, "jobId must be a UUID");
      let value: unknown;
      try {
        const body = await request.text();
        if (body.length > 64) throw new Error();
        value = body.trim() ? JSON.parse(body) : {};
      } catch {
        throw new KnowledgeError(
          "invalid_request",
          400,
          "Continuation accepts no routing or overrides",
        );
      }
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length)
        throw new KnowledgeError(
          "invalid_request",
          400,
          "Continuation accepts no routing or overrides",
        );
      return continueQuestionResearch(artistId, jobId, auth);
    },
    202,
  );
}
