import { z } from "zod";
import { answerVerdictSchema } from "../answerVerdictSchema";
const dimension = z.object({
  score: z.number().min(0).max(1),
  reason: z.string(),
});
/** Same one judge call; legacy fields project separately from these rubric diagnostics. */
export const diagnosticVerdictSchema = answerVerdictSchema.extend({
  citedSupport: dimension,
  requestedInventoryCoverage: dimension,
  counterevidenceHandling: dimension,
  uncertaintyHandling: dimension,
  responseUsability: dimension,
});
