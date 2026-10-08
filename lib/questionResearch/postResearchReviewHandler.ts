import { z } from "zod";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { reviewResearchDiscovery } from "@/lib/questionResearch/reviewResearchDiscovery";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Artist-controlled review of a specific revision; public research never promotes content. */
export async function postResearchReviewHandler(
  request: Request,
  artistId: string,
  candidateId: string,
) {
  return withResearchRequest(request, artistId, true, async auth => {
    if (auth.kind !== "artist")
      throw new KnowledgeError("forbidden", 403, "Artist access required");
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length > 1024) throw new Error();
      body = JSON.parse(raw);
    } catch {
      throw new KnowledgeError("invalid_request", 400, "Invalid review request");
    }
    const parsed = z
      .object({
        revision: z.string().regex(/^[a-f0-9]{64}$/),
        decision: z.enum(["approve", "decline", "wrong_artist", "incorrect"]),
      })
      .strict()
      .safeParse(body);
    if (!parsed.success || !z.uuid().safeParse(candidateId).success)
      throw new KnowledgeError("invalid_request", 400, "Invalid review revision or decision");
    return reviewResearchDiscovery(
      artistId,
      auth.userId,
      candidateId,
      parsed.data.revision,
      parsed.data.decision,
    );
  });
}
