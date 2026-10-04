import type { InterviewEvidence } from "@/lib/interviewExperiment/types";

/** Search original text with model-proposed vocabulary; no generated summary becomes evidence.
 * @param items - The frozen artist archive.
 * @param query - A bounded search phrase generated from the assignment.
 * @param asOf - Latest permitted publication and availability time.
 * @returns Up to six unique matching records, including older material.
 */
export function searchInterviewEvidence(
  items: InterviewEvidence[],
  query: string,
  asOf: string,
): InterviewEvidence[] {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].slice(0, 12);
  if (!terms.length) return [];
  const cutoff = Date.parse(asOf);
  const seen = new Set<string>();
  return items
    .filter(e => {
      if (
        seen.has(e.id) ||
        !(Date.parse(e.availableAt) <= cutoff) ||
        (e.publishedAt && !(Date.parse(e.publishedAt) <= cutoff))
      )
        return false;
      seen.add(e.id);
      return true;
    })
    .map(e => ({
      e,
      score: terms.reduce((s, t) => s + (e.text.toLowerCase().includes(t) ? 1 : 0), 0),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id))
    .slice(0, 6)
    .map(x => x.e);
}
