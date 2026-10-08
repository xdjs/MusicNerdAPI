import { withInterviewMemoryRequest } from "@/lib/interviewMemory/withInterviewMemoryRequest";
import { validateBoundaryListQuery } from "@/lib/interviewMemory/validateBoundaryListQuery";
import { loadInterviewBoundaries } from "@/lib/interviewMemory/loadInterviewBoundaries";
/** List active exact instructions without the model-memory assembly limit. */
export async function getInterviewBoundariesHandler(request: Request, artistId: string) {
  return withInterviewMemoryRequest(request, artistId, async userId =>
    loadInterviewBoundaries(
      artistId,
      userId,
      validateBoundaryListQuery(Object.fromEntries(new URL(request.url).searchParams)),
    ),
  );
}
