import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSourceExtractionHandler } from "@/lib/sourceExtraction/postSourceExtractionHandler";
export const dynamic = "force-dynamic";
/**
 * Return the cross-origin preflight headers.
 *
 * @returns Empty successful preflight.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
/**
 * Queue explicitly selected missing Lore URL bodies for an approved claimant or administrator.
 *
 * @param request - Authenticated request and explicit source selection.
 * @param context - Route context.
 * @param context.params - Artist ID.
 * @returns Accepted job, no-op, or safe validation/auth/storage error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postSourceExtractionHandler(request, (await context.params).id);
}
