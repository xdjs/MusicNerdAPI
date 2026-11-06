import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { SOURCE_TYPES } from "@/lib/sources/const";

const bodySchema = z
  .object({
    status: z.enum(["approved", "rejected"]).optional(),
    expectedStatus: z.literal("pending").optional(),
    type: z.enum(SOURCE_TYPES).optional(),
  })
  .refine(body => body.status || body.type)
  .refine(body => !body.expectedStatus || body.status);

/** What a source update may change. */
export type PatchVaultSourceBody = z.infer<typeof bodySchema>;

/**
 * Validates a source update: a review decision (optionally only while the
 * source is still pending), a type, or both.
 *
 * @param body - The parsed JSON body, or null when it wasn't JSON.
 * @returns The update, or a 400.
 */
export function validatePatchVaultSourceBody(body: unknown): PatchVaultSourceBody | NextResponse {
  const parsed = bodySchema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Send status or type" },
    { status: 400, headers: getCorsHeaders() },
  );
}
