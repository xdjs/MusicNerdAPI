import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { editorSourceSearchHandler } from "@/lib/editorSourceSearch/editorSourceSearchHandler";
export const dynamic = "force-dynamic";
/**
 * Allows cross-origin authenticated editor source-search requests.
 *
 * @returns Preflight headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
/**
 * Queues one source-search request for the authenticated claimant or administrator.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns Safe request status or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return editorSourceSearchHandler(request, (await context.params).id);
}
/**
 * Reads an authenticated request's progress without starting external work.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns Safe request status or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return editorSourceSearchHandler(request, (await context.params).id);
}
