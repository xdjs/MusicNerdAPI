/**
 * Drops a URL's query string and fragment, which are never part of a handle.
 * Deliberately a string split, not `lib/sources/stripQuery`'s URL round-trip:
 * that normalizes too, and adds a trailing slash to a bare domain, which broke
 * Bandcamp's canonical "<handle>.bandcamp.com".
 *
 * @param raw - The URL.
 * @returns It, up to the first `?` or `#`.
 */
export function stripUrlQuery(raw: string): string {
  return raw.split(/[?#]/)[0];
}
