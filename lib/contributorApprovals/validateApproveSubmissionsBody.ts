import { NextResponse } from "next/server";
import { z } from "zod";
import { CONTRIBUTOR_APPROVAL_BATCH } from "@/lib/contributorApprovals/const";
import type { ContributorSubmission } from "@/lib/contributorApprovals/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({
  items: z
    .array(z.object({ id: z.uuid(), type: z.enum(["link", "lore", "upload"]) }))
    .min(1)
    .max(CONTRIBUTOR_APPROVAL_BATCH),
});

/**
 * Validates the body of POST /api/admin/users/{id}/submissions/approve: 1 to
 * 10 submissions, each an id and a type.
 *
 * @param request - The request.
 * @returns `{ items }`, or a 400 with `{ status: "error", error }`.
 */
export async function validateApproveSubmissionsBody(
  request: Request,
): Promise<{ items: ContributorSubmission[] } | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Invalid approval selection" },
    { status: 400, headers: getCorsHeaders() },
  );
}
