import { loadInterviewMemory } from "@/lib/interviewMemory/loadInterviewMemory";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
import { assembleInterviewMemory } from "@/lib/interviewMemory/assembleInterviewMemory";
import type { MemoryPage } from "@/lib/interviewMemory/types";
import type { KnowledgeToolConfig } from "./types";
/** Assemble every exact constraint from one internally authorized read-only snapshot. */
export async function fetchMandatoryInterviewMemory(
  config: KnowledgeToolConfig,
  sitting: number,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const snapshot = await loadInterviewMemory(config.artistId, config.userId, sitting);
  const pages: MemoryPage[] = [];
  let cursor: string | undefined;
  do {
    const page = pageInterviewMemory(snapshot, { maxChars: 12000, ...(cursor ? { cursor } : {}) });
    pages.push(page);
    if (pages.length > 100 || JSON.stringify(pages).length > 96000)
      throw new Error("Mandatory memory exceeds its context budget");
    cursor = page.budget.nextCursor ?? undefined;
  } while (cursor);
  signal?.throwIfAborted();
  return assembleInterviewMemory(pages);
}
