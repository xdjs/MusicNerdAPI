/**
 * Host guards for the two urlmap patterns that match too much. X's stored
 * pattern matches any host with "x." in it (max.com/movie read as x=movie), and
 * Wikipedia is English-only. The patterns live in the database, so they are
 * guarded here rather than fixed by migration.
 *
 * @param siteName - The urlmap row's platform.
 * @param url - The URL being resolved, scheme optional.
 * @returns False when the row must not be tried on this URL.
 */
export function hostAllowedFor(siteName: string, url: string): boolean {
  if (siteName !== "x" && siteName !== "wikipedia") return true;
  try {
    const hostname = new URL(
      url.startsWith("http") ? url : `https://${url}`,
    ).hostname.toLowerCase();
    if (siteName === "x") return hostname === "x.com" || hostname.endsWith(".x.com");
    return hostname === "en.wikipedia.org" || hostname === "en.m.wikipedia.org";
  } catch {
    return false;
  }
}
