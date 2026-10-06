import { withInterviewMemoryRequest } from "@/lib/interviewMemory/withInterviewMemoryRequest";
import { saveInterviewBoundary } from "@/lib/interviewMemory/saveInterviewBoundary";
import { readMemoryRequestBody } from "@/lib/interviewMemory/readMemoryRequestBody";
/** Capture an explicitly chosen artist instruction, never an inferred permanent boundary. */
export async function postInterviewBoundaryHandler(request: Request, artistId: string) {
  return withInterviewMemoryRequest(request, artistId, async userId =>
    saveInterviewBoundary(artistId, userId, await readMemoryRequestBody(request)),
  );
}
