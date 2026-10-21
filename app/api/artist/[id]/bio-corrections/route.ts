import { NextResponse } from "next/server";
import { postBioCorrectionHandler } from "@/lib/bioCorrections/postBioCorrectionHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 204 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Files a signed-in account's report on the artist's About for admin review.
 *
 * @param request - The request; a Privy token and the report.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 201 filed or 200 duplicate with `{ status, success, duplicate }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postBioCorrectionHandler(request, id);
}
