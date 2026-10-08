import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Validate explicit artist instructions without trimming or rewriting their words. */
export function validateBoundaryBody(value: unknown) {
  const result = z
    .object({
      requestId: z.uuid(),
      questionKey: z.string().min(1).max(500),
      wording: z
        .string()
        .min(1)
        .max(4000)
        .refine(v => v.trim().length > 0),
      scope: z.enum(["sitting", "until_retracted"]),
    })
    .strict()
    .safeParse(value);
  if (!result.success)
    throw new KnowledgeError("invalid_input", 400, "Invalid boundary instruction");
  return result.data;
}
