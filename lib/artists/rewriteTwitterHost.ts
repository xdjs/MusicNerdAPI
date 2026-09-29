/**
 * twitter.com is X. urlmap's X pattern only matches x.com, so every legacy
 * twitter.com link (MusicBrainz returned one for Pete Rango) was dropped. The
 * scheme is optional because callers pass bare domains too.
 *
 * @param url - A URL, with or without a scheme.
 * @returns The URL with a twitter.com host rewritten to x.com.
 */
export function rewriteTwitterHost(url: string): string {
  return url.replace(
    /^(https?:\/\/)?(?:www\.|mobile\.|m\.)?twitter\.com(?=[/?#]|$)/i,
    (_m, scheme) => `${scheme ?? ""}x.com`,
  );
}
