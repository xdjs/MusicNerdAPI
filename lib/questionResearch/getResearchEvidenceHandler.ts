import { z } from "zod";
import { readResearchOriginal } from "@/lib/questionResearch/readResearchOriginal";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Read a bounded exact original under public-evidence or current private-review authorization. */
export async function getResearchEvidenceHandler(
  request: Request,
  artistId: string,
  evidenceId: string,
) {
  return withResearchRequest(request, artistId, false, async auth => {
    const parsed = z
      .object({
        revision: z.string(),
        start: z.coerce.number().default(0),
        maxChars: z.coerce.number().default(4000),
      })
      .strict()
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success)
      throw new KnowledgeError("invalid_request", 400, "Invalid original revision or text window");
    return readResearchOriginal(
      artistId,
      auth,
      evidenceId,
      parsed.data.revision,
      parsed.data.start,
      parsed.data.maxChars,
    );
  });
}
