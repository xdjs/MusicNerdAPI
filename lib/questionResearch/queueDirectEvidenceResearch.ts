import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { queueQuestionResearch } from "@/lib/questionResearch/queueQuestionResearch";
import { selectDirectResearchCandidates } from "@/lib/questionResearch/selectDirectResearchCandidates";
import type { ResearchRequest } from "@/lib/questionResearch/types";

/** Queue a service request that first offers bounded saved candidates (`preferDirectEvidence`). Read before the global admission transaction; never hold its quota lock over a corpus read. */
export async function queueDirectEvidenceResearch(artistId: string, routing: ResearchRequest) {
  const artist = await loadResearchArtist(artistId);
  const originals = await loadPublicResearchOriginals(artistId);
  const selected = selectDirectResearchCandidates(originals, routing, artist.name ?? "");
  return queueQuestionResearch(artistId, { kind: "service" }, routing, {
    directCandidates: selected.references,
  });
}
