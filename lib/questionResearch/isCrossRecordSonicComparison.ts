import type { ResearchRequest } from "./types";

const crossRecordScope =
  /\b(?:(?:early|later|first|second|debut|subsequent|previous|newer|older)\s+(?:albums?|records?|releases?)|(?:between|across)\b.{0,100}\b(?:albums?|records?|releases?)|(?:albums?|records?|releases?)\b.{0,70}\b(?:versus|vs\.?|compared with|and)\b)/i;

/** Identify explicit cross-record sonic comparisons for the durable research navigator. */
export function isCrossRecordSonicComparison(request: ResearchRequest): boolean {
  if (request.evidenceNeed !== "reporting" || request.retrieval === "latest" || request.targetUrl)
    return false;

  const topic = request.topic;
  if (/\b(?:not|never|no|do not|don't|without|avoid\w*|excluding)\b/i.test(topic)) return false;
  const comparesOrChanges =
    /\b(?:compar\w*|contrast\w*|chang\w*|evol\w*|shift\w*|differ\w*)\b/i.test(topic);
  const namesSonicDimension =
    /\b(?:sound|sonic|tone|timbre|style|arrangement\w*|instrumentation)\b/i.test(topic);

  return comparesOrChanges && namesSonicDimension && crossRecordScope.test(topic);
}
