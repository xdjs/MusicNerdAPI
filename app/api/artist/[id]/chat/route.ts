import { NextResponse } from "next/server";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Streams an answer to a fan's question about an artist, cited from the
 * artist's stored sources (or the web when they can't answer). Public; a
 * Privy token only scopes the hourly question allowance to the account.
 *
 * @param request - `{ messages: UIMessage[] }`.
 * @param context - Route context.
 * @param context.params - The artist id.
 * @returns An AI SDK UI message stream, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postArtistChatHandler(request, (await context.params).id);
}
