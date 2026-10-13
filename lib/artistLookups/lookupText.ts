import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * A plain-text answer, the shape MusicNerdWeb's lookups use for every error.
 *
 * @param message - The body.
 * @param status - The HTTP status.
 * @returns The response, with CORS.
 */
export function lookupText(message: string, status: number): Response {
  return new Response(message, { status, headers: getCorsHeaders() });
}
