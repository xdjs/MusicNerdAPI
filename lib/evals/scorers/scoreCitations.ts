import { findCitationNumbers } from "@/lib/chat/findCitationNumbers";
import type { Score } from "@/lib/evals/Score";

type CitationsMetadata = { cited: number[]; dangling: number[] };

/**
 * Whether an answer's citation markers point at sources it returned. Markers are read with the
 * chat's own grammar (`findCitationNumbers`): "[13, 8, 86]" is three, a mixed group such as
 * "[19, 21, Artist Doc]" keeps its numbers, "[1, §Live, 1999]" cites 1 only, and "[2026-05-13]" is a
 * date, not a citation.
 *
 * @param answer - The answer text.
 * @param citable - The `n` of every source returned with the answer.
 * @returns The fraction of cited numbers that are citable, and 0 when the answer cites
 *   nothing: an answer written from sources is expected to say which.
 */
export function scoreCitations(answer: string, citable: number[]): Score<CitationsMetadata> {
  const cited = [...new Set(findCitationNumbers(answer).map(c => c.n))];
  const known = new Set(citable);
  const dangling = cited.filter(n => !known.has(n));
  return {
    name: "citations",
    score: cited.length === 0 ? 0 : (cited.length - dangling.length) / cited.length,
    metadata: { cited, dangling },
  };
}
