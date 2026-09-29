/**
 * Whether a URL is one of Google's grounded-search redirect tokens. They
 * expire and then 404, so one must never be cited.
 *
 * @param url - The URL.
 * @returns True for a vertexaisearch.cloud.google.com redirect.
 */
export function isGroundingRedirect(url: string): boolean {
  return url.includes("vertexaisearch.cloud.google.com");
}
