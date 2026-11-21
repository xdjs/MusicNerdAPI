/**
 * The authorization server's issuer, on the origin this deployment serves.
 *
 * @param origin - The request's origin, like `https://api.musicnerd.net`.
 * @returns The issuer URL.
 */
export function getOAuthIssuer(origin: string): string {
  return `${origin}/api/oauth`;
}
