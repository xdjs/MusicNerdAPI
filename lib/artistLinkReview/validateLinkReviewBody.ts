import { NextResponse } from "next/server";
import { z } from "zod";
import type { LinkReviewDecision } from "@/lib/artistLinkReview/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const linkReviewSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["ugc", "source"]),
  decision: z.enum(["approve", "dismiss", "remove", "restore"]),
});

/**
 * Validates POST /api/artist/{id}/link-suggestions: a UUID artist id and a
 * `{ id, kind, decision }` body.
 *
 * @param body - The parsed JSON body, or null.
 * @param id - The artist id from the path.
 * @returns `{ artistId, input }`, or a 400 `Invalid review request`.
 */
export function validateLinkReviewBody(
  body: unknown,
  id: string,
): { artistId: string; input: LinkReviewDecision } | NextResponse {
  const input = linkReviewSchema.safeParse(body);
  if (!z.uuid().safeParse(id).success || !input.success)
    return NextResponse.json(
      { status: "error", error: "Invalid review request" },
      { status: 400, headers: getCorsHeaders() },
    );
  return { artistId: id, input: input.data };
}
