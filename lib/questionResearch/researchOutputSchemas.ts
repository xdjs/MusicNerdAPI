import { z } from "zod";
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
export const researchSourceIdSchema = z
  .string()
  .regex(
    new RegExp(`^(?:(?:discovery|vault):${uuid}|social:${uuid}:(?:caption|transcript))$`, "i"),
  );
const passage = z.object({
  sourceId: researchSourceIdSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  text: z.string().max(12000),
  url: z.string().url(),
  curation: z.enum(["approved", "pending"]),
  evidenceKind: z.enum(["original_text", "caption", "provider_transcript"]),
  speaker: z.enum(["not_applicable", "unverified"]),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string().nullable(),
  truncated: z.boolean().nullable(),
});
export const researchOutputSchemas = {
  status: z.object({
    status: z.literal("ok"),
    jobId: z.uuid(),
    stage: z.enum([
      "checking_saved",
      "searching",
      "reading",
      "transcribing",
      "waiting_provider",
      "complete",
      "unresolved",
      "failed",
      "cancelled",
    ]),
    provider: z.enum(["web", "page", "instagram", "instagram_reels", "tiktok", "x"]).nullable(),
    message: z.string().max(2000),
    updatedAt: z.string(),
    references: z.array(passage).max(6),
    limitations: z.array(z.string()).max(30),
    reused: z.boolean().optional(),
  }),
  read: z.object({
    status: z.literal("ok"),
    passage,
    totalChars: z.number().int().nonnegative(),
    nextStart: z.number().int().nonnegative().nullable(),
  }),
};
