/**
 * The token from an `Authorization: Bearer <token>` header.
 *
 * @param request - The incoming request.
 * @returns The token, or null when there is no Bearer token.
 */
export function getBearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") ?? "");
  const token = match?.[1]?.trim();
  return token ? token : null;
}
