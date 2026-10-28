/**
 * A stored source's display title: its host without `www.` (stored originals keep no page title).
 *
 * @param url - The source URL.
 * @returns The host.
 */
export function getSourceTitle(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}
