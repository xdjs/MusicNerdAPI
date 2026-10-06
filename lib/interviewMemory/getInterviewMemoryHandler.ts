import { z } from "zod";
import { withInterviewMemoryRequest } from "@/lib/interviewMemory/withInterviewMemoryRequest";
import { loadInterviewMemory } from "@/lib/interviewMemory/loadInterviewMemory";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Read exact mandatory memory with revision-bound continuations, never optional omission filters. */
export async function getInterviewMemoryHandler(request: Request, artistId: string) {
  return withInterviewMemoryRequest(request, artistId, async userId => {
    const result = z
      .object({
        sitting: z.coerce.number().int().min(1).max(2147483647),
        maxChars: z.coerce.number().int().min(1000).max(20000).default(12000),
        cursor: z.string().min(1).max(4096).optional(),
      })
      .strict()
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!result.success) throw new KnowledgeError("invalid_input", 400, "Invalid memory query");
    return pageInterviewMemory(
      await loadInterviewMemory(artistId, userId, result.data.sitting),
      result.data,
    );
  });
}
