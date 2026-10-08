import { z } from "zod";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { ResponseOperation, ResponseQuery } from "./types";

/** Validate IDs and operation-specific query fields before reading private records. */
export function validateInterviewResponseRequest(
  request: Request,
  artistId: string,
  operation: ResponseOperation,
  answerId?: string,
): ResponseQuery {
  if (
    !z.uuid().safeParse(artistId).success ||
    (operation !== "list" && !z.uuid().safeParse(answerId).success)
  )
    throw new KnowledgeError("invalid_input", 400, "Invalid artist or response");
  const params = new URL(request.url).searchParams;
  const fields: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in fields) throw new KnowledgeError("invalid_input", 400, "Repeated query parameter");
    fields[key] = value;
  }
  const revision = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional();
  const schema =
    operation === "list" || operation === "versions"
      ? z
          .object({
            limit: z.coerce.number().int().min(1).max(20).default(10),
            cursor: z.string().min(1).max(4096).optional(),
          })
          .strict()
      : operation === "read"
        ? z.object({ revision }).strict()
        : z.object({}).strict();
  const parsed = schema.safeParse(fields);
  if (!parsed.success) throw new KnowledgeError("invalid_input", 400, "Invalid response query");
  return parsed.data;
}
