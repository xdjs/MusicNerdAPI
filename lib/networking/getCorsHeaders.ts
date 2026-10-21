/**
 * The CORS headers every `/api/*` response carries: any origin, the API's
 * methods, the headers clients authenticate with, and `X-Profile-Account`,
 * which the profile page sends to detect a changed account.
 *
 * @returns The CORS headers.
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, x-api-key, X-Profile-Account",
  };
}
