import { z } from "zod";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { listResearchDiscoveries } from "@/lib/questionResearch/listResearchDiscoveries";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Claimant/admin-only pending review; a public research key cannot enumerate the queue. */
export async function getResearchDiscoveriesHandler(request: Request, artistId: string) {
  return withResearchRequest(request, artistId, true, async auth => {
    if (auth.kind !== "artist")
      throw new KnowledgeError("forbidden", 403, "Artist access required");
    const p = new URL(request.url).searchParams;
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(20).default(10),
        cursor: z.uuid().optional(),
      })
      .strict()
      .safeParse(Object.fromEntries(p));
    if (!parsed.success) throw new KnowledgeError("invalid_request", 400, "Invalid review page");
    return listResearchDiscoveries(artistId, auth.userId, parsed.data.limit, parsed.data.cursor);
  });
}
