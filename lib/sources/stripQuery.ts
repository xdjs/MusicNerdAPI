/**
 * A URL without its query and fragment, which are never part of a platform
 * handle (`extractArtistId` would fold "?hl=en" into one).
 *
 * @param raw - A URL.
 * @returns The URL without query or fragment; for an unparseable string, everything before the first ? or #.
 */
export function stripQuery(raw: string): string {
  try {
    const u = new URL(raw);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return raw.split(/[?#]/)[0];
  }
}
