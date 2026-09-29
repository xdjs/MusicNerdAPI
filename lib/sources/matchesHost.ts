/**
 * Whether a URL belongs to any host in a list. An entry with a path
 * ("last.fm/user") matches as a substring of the URL; a bare domain matches
 * itself and its subdomains, never a look-alike such as notboomplay.com.
 *
 * @param host - The URL's host, from `hostOf`.
 * @param url - The URL.
 * @param list - Registrable domains, or domains with a path.
 * @returns True when the URL is on one of them.
 */
export function matchesHost(host: string, url: string, list: string[]): boolean {
  return list.some(h =>
    h.includes("/") ? url.toLowerCase().includes(h) : host === h || host.endsWith(`.${h}`),
  );
}
