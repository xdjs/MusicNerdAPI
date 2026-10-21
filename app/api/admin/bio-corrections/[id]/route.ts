import { NextResponse } from "next/server";
import { patchBioCorrectionHandler } from "@/lib/bioCorrections/patchBioCorrectionHandler";
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
 * Resolves or dismisses a pending About correction report.
 *
 * @param request - The request; an admin's Privy token and `{ status }`.
 * @param context - The route context.
 * @param context.params - Holds the report `id`.
 * @returns 200 with `{ status, success }`, or an error.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return patchBioCorrectionHandler(request, id);
}
