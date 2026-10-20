import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postLoreSuggestionsHandler } from "@/lib/loreSuggestions/postLoreSuggestionsHandler";

export const dynamic = "force-dynamic";

/**
 * Suggest a lore source URL for an artist.
 *
 * @param request - The authenticated request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns The suggestion result or a safe error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postLoreSuggestionsHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
