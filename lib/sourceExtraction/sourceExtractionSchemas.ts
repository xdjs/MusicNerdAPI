import { z } from "zod";
const outcome = z.object({
  sourceId: z.string().uuid(),
  status: z.enum([
    "ready",
    "blocked",
    "empty",
    "unsupported",
    "unavailable",
    "too_large",
    "skipped",
  ]),
  capturedAt: z.string().datetime(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  storedChars: z.number().int().min(0).max(50_000),
  truncated: z.boolean(),
});
export const sourceExtractionSchemas = {
  outcome,
  state: z.object({
    version: z.literal(1),
    userId: z.string().uuid(),
    expectedClaimId: z.string().uuid().nullable(),
    sources: z
      .array(z.object({ id: z.string().uuid(), url: z.string().max(8192) }))
      .min(1)
      .max(20),
    outcomes: z.array(outcome).max(20),
  }),
};
