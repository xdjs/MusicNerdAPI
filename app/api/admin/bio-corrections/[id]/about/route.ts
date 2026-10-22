import { NextResponse } from "next/server";
import { getCorrectionAboutHandler } from "@/lib/bioCorrections/getCorrectionAboutHandler";
import { putCorrectionAboutHandler } from "@/lib/bioCorrections/putCorrectionAboutHandler";
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
 * The About currently published for a report's artist, with its revision.
 *
 * @param request - The request; an admin's Privy token.
 * @param context - The route context.
 * @param context.params - Holds the report `id`.
 * @returns 200 with `{ status, bio, revision }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getCorrectionAboutHandler(request, id);
}

/**
 * Saves the About for a report's artist and resolves the report.
 *
 * @param request - The request; an admin's Privy token and `{ bio, revision }`.
 * @param context - The route context.
 * @param context.params - Holds the report `id`.
 * @returns 200 with `{ status, success }`, or an error.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return putCorrectionAboutHandler(request, id);
}
