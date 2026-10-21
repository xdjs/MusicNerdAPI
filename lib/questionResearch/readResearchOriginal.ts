import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readPublicResearchSource } from "@/lib/questionResearch/readPublicResearchSource";
import { readResearchEvidence } from "@/lib/questionResearch/readResearchEvidence";
import { researchSourceIdSchema } from "@/lib/questionResearch/researchOutputSchemas";
import type { ResearchAuth } from "@/lib/questionResearch/types";

/** Read a bounded exact original by source identity: public saved sources under current eligibility, discoveries under the caller's review authorization. The checks are the evidence route's. */
export async function readResearchOriginal(
  artistId: string,
  auth: ResearchAuth,
  evidenceId: string,
  revision: string,
  start: number,
  maxChars: number,
) {
  const window = z
    .object({
      revision: z.string().regex(/^[a-f0-9]{64}$/),
      start: z.number().int().min(0).max(4000000),
      maxChars: z.number().int().min(256).max(12000),
    })
    .safeParse({ revision, start, maxChars });
  if (
    !window.success ||
    (!z.uuid().safeParse(evidenceId).success &&
      !researchSourceIdSchema.safeParse(evidenceId).success)
  )
    throw new KnowledgeError("invalid_request", 400, "Invalid original revision or text window");
  if (
    evidenceId.startsWith("vault:") ||
    evidenceId.startsWith("social:") ||
    evidenceId.startsWith("public_answer:") ||
    evidenceId.startsWith("latest:")
  )
    return readPublicResearchSource(artistId, evidenceId, revision, start, maxChars);
  return readResearchEvidence(
    artistId,
    auth,
    evidenceId.replace(/^discovery:/, ""),
    revision,
    start,
    maxChars,
  );
}
