/**
 * A URL's host, lowercase and without "www.".
 *
 * @param url - Any URL.
 * @returns The host, or "" when the URL cannot be parsed.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
