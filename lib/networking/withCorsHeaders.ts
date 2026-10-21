import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The same response with the API's CORS headers added, the body (streaming
 * included) passed through untouched.
 *
 * @param response - A response another library built.
 * @returns A response with the CORS headers.
 */
export function withCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(getCorsHeaders())) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
