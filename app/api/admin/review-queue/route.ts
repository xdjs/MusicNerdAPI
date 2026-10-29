import { NextResponse } from "next/server";
import { getAdminReviewQueueHandler } from "@/lib/adminReview/getAdminReviewQueueHandler";
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
 * One page of the review queue: pending links, sources and About corrections.
 *
 * @param request - The request; an admin's Privy token and optional `type`, `query`, `page`.
 * @returns 200 with the page and per-type counts, or an error.
 */
export async function GET(request: Request) {
  return getAdminReviewQueueHandler(request);
}
