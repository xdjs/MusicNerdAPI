import { NextResponse } from "next/server";
import { postApproveSubmissionsHandler } from "@/lib/contributorApprovals/postApproveSubmissionsHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Approves up to 10 of the contributor's pending submissions.
 *
 * @param request - The request; an admin's Privy token and `{ items }`.
 * @param context - The route context.
 * @param context.params - Holds the contributor's user `id`.
 * @returns 200 with `{ status, approved, skipped, failed, warning? }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postApproveSubmissionsHandler(request, id);
}
