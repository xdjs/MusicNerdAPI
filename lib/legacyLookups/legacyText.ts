import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * A plain-text answer, the shape the legacy lookups use for every error.
 *
 * @param message - The body.
 * @param status - The HTTP status.
 * @returns The response, with CORS.
 */
export function legacyText(message: string, status: number): Response {
  return new Response(message, { status, headers: getCorsHeaders() });
}
