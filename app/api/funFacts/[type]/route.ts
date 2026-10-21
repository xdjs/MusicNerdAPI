import { NextResponse } from "next/server";
import { getFunFactHandler } from "@/lib/funFacts/getFunFactHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight for browser callers on other origins.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Writes one fun fact about an artist: the kind's stored prompt, plus the
 * approved vault sources and the Lore document when the artist has an
 * approved claim. Public; nothing is stored.
 *
 * @param request - The request; `?id=<artistId>`.
 * @param context - The route context.
 * @param context.params - Holds the `type`: surprise, lore, bts or activity.
 * @returns 200 with `{ status, text }`, or an error with 400, 404, 408 or 500.
 */
export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  return getFunFactHandler(request, type);
}
