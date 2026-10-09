import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { validateResearchUrl } from "@/lib/questionResearch/validateResearchUrl";
import type { ResearchRequest } from "@/lib/questionResearch/types";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(s => {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  });
const schema = z
  .object({
    topic: z
      .string()
      .trim()
      .min(3)
      .max(160)
      .refine(s => !/[\u0000-\u001f\u007f]/.test(s)),
    evidenceNeed: z.enum([
      "reporting",
      "release_date",
      "credits",
      "social_caption",
      "spoken_content",
    ]),
    freshness: z.enum(["stored", "recent"]).default("stored"),
    retrieval: z.enum(["relevance", "latest"]).optional(),
    targetUrl: z.string().max(2048).optional(),
    excludeSourceUrls: z.array(z.string().max(2000)).max(10).optional(),
    platform: z.enum(["instagram", "tiktok", "x", "inprocess", "spotify", "deezer"]).optional(),
    fromDate: date.optional(),
    toDate: date.optional(),
  })
  .strict()
  .refine(s => !s.fromDate || !s.toDate || s.fromDate <= s.toDate);
/** Parse the server-bounded evidence request, refusing actor, account and spending overrides. */
export function validateQuestionResearchBody(value: unknown): ResearchRequest {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new KnowledgeError("invalid_request", 400, "Invalid bounded research request");
  return {
    ...parsed.data,
    ...(parsed.data.excludeSourceUrls
      ? { excludeSourceUrls: [...new Set(parsed.data.excludeSourceUrls.map(validateResearchUrl))] }
      : {}),
    ...(parsed.data.targetUrl ? { targetUrl: validateResearchUrl(parsed.data.targetUrl) } : {}),
  };
}
