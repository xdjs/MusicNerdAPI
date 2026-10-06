import { z } from "zod";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { getQuestionResearchStatus } from "@/lib/questionResearch/getQuestionResearchStatus";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Resume a durable job through a safe projection, with current evidence eligibility. */
export async function getQuestionResearchHandler(
  request: Request,
  artistId: string,
  jobId: string,
) {
  return withResearchRequest(request, artistId, false, async auth => {
    if (!z.uuid().safeParse(jobId).success)
      throw new KnowledgeError("invalid_request", 400, "jobId must be a UUID");
    return getQuestionResearchStatus(artistId, jobId, auth);
  });
}
