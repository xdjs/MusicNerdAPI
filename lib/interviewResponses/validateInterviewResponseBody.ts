import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";

/** Accept exact nonblank artist wording and a required current revision, never caller identity. */
export function validateInterviewResponseBody(body: unknown) {
  const parsed = z
    .object({
      expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
      answer: z
        .string()
        .min(1)
        .max(2000)
        .refine(value => Boolean(value.trim())),
      note: z.string().max(400).default(""),
    })
    .strict()
    .safeParse(body);
  if (!parsed.success) throw new KnowledgeError("invalid_input", 400, "Invalid response edit");
  return parsed.data;
}
