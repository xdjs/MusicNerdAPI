/**
 * Only Instagram's media hosts, never arbitrary URLs from scraped metadata.
 *
 * @param value - A URL taken from a scraped post.
 * @returns The normalized https URL, or null when it is not an Instagram media host.
 */
export function instagramMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    return ["cdninstagram.com", "fbcdn.net"].some(host => url.hostname.endsWith(`.${host}`))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
