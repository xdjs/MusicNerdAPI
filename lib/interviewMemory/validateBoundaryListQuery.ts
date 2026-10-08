import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Accept only the sitting and a bounded continuation for active instruction management. */
export function validateBoundaryListQuery(value: unknown) {
  const result = z
    .object({
      sitting: z.coerce.number().int().min(1).max(2147483647),
      cursor: z.string().min(1).max(4096).optional(),
    })
    .strict()
    .safeParse(value);
  if (!result.success)
    throw new KnowledgeError("invalid_input", 400, "Invalid boundary list query");
  return result.data;
}
