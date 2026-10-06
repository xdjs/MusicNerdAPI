import { z } from "zod";
import { researchSourceIdSchema } from "@/lib/questionResearch/researchOutputSchemas";
import { readPublicResearchSource } from "@/lib/questionResearch/readPublicResearchSource";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { readResearchEvidence } from "@/lib/questionResearch/readResearchEvidence";
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
        revision: z.string().regex(/^[a-f0-9]{64}$/),
        start: z.coerce.number().int().min(0).max(4000000).default(0),
        maxChars: z.coerce.number().int().min(256).max(12000).default(4000),
      })
      .strict()
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (
      !parsed.success ||
      (!z.uuid().safeParse(evidenceId).success &&
        !researchSourceIdSchema.safeParse(evidenceId).success)
    )
      throw new KnowledgeError("invalid_request", 400, "Invalid original revision or text window");
    if (evidenceId.startsWith("vault:") || evidenceId.startsWith("social:"))
      return readPublicResearchSource(
        artistId,
        evidenceId,
        parsed.data.revision,
        parsed.data.start,
        parsed.data.maxChars,
      );
    return readResearchEvidence(
      artistId,
      auth,
      evidenceId.replace(/^discovery:/, ""),
      parsed.data.revision,
      parsed.data.start,
      parsed.data.maxChars,
    );
  });
}
