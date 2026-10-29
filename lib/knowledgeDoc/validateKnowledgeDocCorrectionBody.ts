import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_CLAIM_CHARS, MAX_CORRECTION_CHARS } from "@/lib/knowledgeDoc/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.object({
  claim: z.string(),
  kind: z.enum(["wrong", "fix"]),
  correction: z.string().nullish(),
});

/**
 * Validates the body of POST /api/artist/{id}/knowledge-doc/corrections. The
 * claim is trimmed and capped at the length corrections are keyed on; a fix
 * keeps the artist's trimmed wording, a `wrong` keeps none.
 *
 * @param body - The parsed JSON body.
 * @returns `{ claim, kind, correction }`, or a 400.
 */
export function validateKnowledgeDocCorrectionBody(
  body: unknown,
): { claim: string; kind: "wrong" | "fix"; correction: string | null } | NextResponse {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("Invalid correction");
  const { kind } = parsed.data;
  const claim = parsed.data.claim.trim().slice(0, MAX_CLAIM_CHARS);
  if (!claim) return fail("No claim given");
  if (kind === "wrong") return { claim, kind, correction: null };
  // A fix with no wording would teach the rebuild to delete the claim.
  const correction = (parsed.data.correction ?? "").trim().slice(0, MAX_CORRECTION_CHARS);
  if (!correction) return fail("Write your correction first");
  return { claim, kind, correction };
}
