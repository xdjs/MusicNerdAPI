import type { ResearchRequest } from "./types";

/** Return a bounded vocabulary query for typed evidence intent, if one applies. */
export function researchIntentSupplement(request: ResearchRequest): string | null {
  if (/\b(?:not|except|exclud\w*|without|avoid\w*|other than)\b/i.test(request.topic)) return null;

  if (request.evidenceNeed === "credits")
    return "collaboration collaborator collaborated produced producer featuring featured feat drums vocals written songwriting credits";

  return null;
}
