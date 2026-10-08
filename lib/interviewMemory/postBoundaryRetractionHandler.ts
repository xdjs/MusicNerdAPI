import { z } from "zod";
import { withInterviewMemoryRequest } from "@/lib/interviewMemory/withInterviewMemoryRequest";
import { retractInterviewBoundary } from "@/lib/interviewMemory/retractInterviewBoundary";
import { readMemoryRequestBody } from "@/lib/interviewMemory/readMemoryRequestBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Retract the exact artist-reviewed instruction and preserve its original wording. */
export async function postBoundaryRetractionHandler(
  request: Request,
  artistId: string,
  boundaryId: string,
) {
  return withInterviewMemoryRequest(request, artistId, async userId => {
    const input = z
      .object({ revision: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .safeParse(await readMemoryRequestBody(request));
    if (!input.success || !z.uuid().safeParse(boundaryId).success)
      throw new KnowledgeError("invalid_input", 400, "Invalid boundary revision");
    return retractInterviewBoundary(artistId, userId, boundaryId, input.data.revision);
  });
}
