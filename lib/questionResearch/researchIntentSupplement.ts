import type { ResearchRequest } from "./types";

/** Return a bounded vocabulary query for typed evidence intent, if one applies. */
export function researchIntentSupplement(request: ResearchRequest): string | null {
  if (/\b(?:not|except|exclud\w*|without|avoid\w*|other than)\b/i.test(request.topic)) return null;

  if (request.evidenceNeed === "credits")
    return "collaboration collaborator collaborated produced producer featuring featured feat drums vocals written songwriting credits";

  if (
    request.evidenceNeed === "reporting" &&
    /\b(?:change\w*|evol(?:v|u)\w*|compar\w*|contrast\w*|since)\b/i.test(request.topic) &&
    /\b(?:sound|sonic|style|arrangement\w*|instrument\w*|synth\w*|guitar\w*|drum\w*|vocal\w*|production sound)\b/i.test(
      request.topic,
    )
  )
    return "change changed evolve evolved evolution compare compared comparison contrast earlier later album sound style arrangement synth guitar electronic";

  return null;
}
