import { sessionInputSchemas } from "./types";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { z } from "zod";
/** Validate exact artist words and complete stable references without silently trimming them. */
export function validateInterviewSessionBody<K extends keyof typeof sessionInputSchemas>(
  operation: K,
  body: unknown,
): z.infer<(typeof sessionInputSchemas)[K]> {
  const parsed = sessionInputSchemas[operation].safeParse(body);
  if (!parsed.success) throw new KnowledgeError("invalid_input", 400, "Invalid interview request");
  return parsed.data as z.infer<(typeof sessionInputSchemas)[K]>;
}
