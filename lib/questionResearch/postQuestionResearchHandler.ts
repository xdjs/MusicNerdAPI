import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";
import { queueQuestionResearch } from "@/lib/questionResearch/queueQuestionResearch";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { selectDirectResearchCandidates } from "@/lib/questionResearch/selectDirectResearchCandidates";
import { isCrossRecordSonicComparison } from "@/lib/questionResearch/isCrossRecordSonicComparison";
/** Acknowledge a persisted request; all model/provider work belongs to the durable worker. */
export async function postQuestionResearchHandler(request: Request, artistId: string) {
  return withResearchRequest(
    request,
    artistId,
    false,
    async auth => {
      let value: unknown;
      try {
        const body = await request.text();
        if (body.length > 4096) throw new Error();
        value = JSON.parse(body);
      } catch {
        throw new KnowledgeError("invalid_request", 400, "Invalid bounded research request");
      }
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new KnowledgeError("invalid_request", 400, "Invalid bounded research request");
      const { preferDirectEvidence, ...neutral } = value as Record<string, unknown>;
      if (preferDirectEvidence !== undefined && typeof preferDirectEvidence !== "boolean")
        throw new KnowledgeError("invalid_request", 400, "Invalid direct evidence preference");
      const routing = validateQuestionResearchBody(neutral);
      if (!preferDirectEvidence) return queueQuestionResearch(artistId, auth, routing);
      if (auth.kind !== "service")
        throw new KnowledgeError("forbidden", 403, "Direct evidence requires a service credential");
      if (isCrossRecordSonicComparison(routing))
        return queueQuestionResearch(artistId, auth, routing);
      // Read before the global admission transaction; never hold its quota lock over a corpus read.
      const artist = await loadResearchArtist(artistId);
      const originals = await loadPublicResearchOriginals(artistId);
      const selected = selectDirectResearchCandidates(originals, routing, artist.name ?? "");
      return queueQuestionResearch(artistId, auth, routing, {
        directCandidates: selected.references,
      });
    },
    202,
  );
}
