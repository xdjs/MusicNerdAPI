import { withInterviewMemoryRequest } from "@/lib/interviewMemory/withInterviewMemoryRequest";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readInterviewSessionBody } from "./readInterviewSessionBody";
import { validateInterviewSessionBody } from "./validateInterviewSessionBody";
import { getInterviewSession } from "./getInterviewSession";
import { startInterviewSession } from "./startInterviewSession";
import { saveInterviewOffer } from "./saveInterviewOffer";
import { saveInterviewAnswer } from "./saveInterviewAnswer";
import { finishInterviewSession } from "./finishInterviewSession";
/** One authenticated HTTP boundary for explicit interview operations; model calls never run here. */
export async function handleInterviewSessionRequest(
  request: Request,
  artistId: string,
  operation: "read" | "start" | "offer" | "answer" | "finish",
  resourceId?: string,
) {
  return withInterviewMemoryRequest(request, artistId, async userId => {
    if (new URL(request.url).search)
      throw new KnowledgeError("invalid_input", 400, "Unexpected interview query");
    if (operation === "read") return getInterviewSession(artistId, userId);
    const body = validateInterviewSessionBody(operation, await readInterviewSessionBody(request));
    if (operation === "start") return startInterviewSession(artistId, userId, body);
    if (!resourceId) throw new KnowledgeError("invalid_input", 400, "Interview resource required");
    if (operation === "offer") return saveInterviewOffer(artistId, userId, resourceId, body);
    if (operation === "answer") return saveInterviewAnswer(artistId, userId, resourceId, body);
    return finishInterviewSession(artistId, userId, resourceId);
  });
}
