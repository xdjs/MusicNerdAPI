import { z } from "zod";
const revision = z.string().regex(/^[a-f0-9]{64}$/),
  uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
export const offerReferenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("original"),
      sourceId: z
        .string()
        .regex(new RegExp(`^(?:vault:${uuid}|social:${uuid}:(?:caption|transcript))$`)),
      revision,
      start: z.number().int().min(0).max(4000000),
      end: z.number().int().min(1).max(4000000),
      quote: z.string().min(8).max(1600),
    })
    .strict(),
  z
    .object({
      kind: z.literal("answer"),
      entryId: z.string().regex(new RegExp(`^answer:${uuid}$`)),
      revision,
      start: z.number().int().min(0).max(4000000),
      end: z.number().int().min(1).max(4000000),
      quote: z.string().min(8).max(1600),
    })
    .strict(),
]);
export const sessionInputSchemas = {
  start: z.object({ requestId: z.uuid() }).strict(),
  offer: z
    .object({
      ordinal: z.number().int().min(1).max(3),
      memorySnapshotId: revision,
      question: z
        .string()
        .min(10)
        .max(500)
        .refine(s => s.trim().length >= 10),
      references: z.array(offerReferenceSchema).min(1).max(3),
    })
    .strict(),
  answer: z
    .object({
      expectedRevision: revision,
      answer: z
        .string()
        .min(1)
        .max(8000)
        .refine(s => s.trim().length > 0)
        .nullable(),
    })
    .strict(),
  finish: z.object({}).strict(),
};
export type OfferReference = z.infer<typeof offerReferenceSchema>;
export type SessionRow = {
  id: string;
  artist_id: string;
  sitting: number;
  state: "active" | "finished";
  created_at: string | Date;
  closed_at: string | Date | null;
};
export type QuestionRow = {
  id: string;
  artist_id: string;
  question_key: string;
  question: string;
  answer: string | null;
  source: string;
  sitting: number | null;
  offered_at: string | Date;
  created_at: string | Date;
  ordinal?: number | null;
  evidence_references?: OfferReference[] | null;
};
