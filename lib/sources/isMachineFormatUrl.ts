/**
 * Whether a URL is a machine format (RSS, Atom, XML, JSON) a person should
 * never be handed as a source. An RSS channel carries its page's title, so a
 * vault once held one article twice, the second as raw XML.
 *
 * @param raw - A candidate URL.
 * @returns True for feeds and data files.
 */
export function isMachineFormatUrl(raw: string): boolean {
  const url = raw.toLowerCase().split(/[?#]/)[0];
  if (/\.(xml|rss|atom|json)$/.test(url)) return true;
  if (/\/(feed|rss|atom)\/?$/.test(url)) return true;
  return /[?&](feed|format)=(rss|atom|xml|json)/.test(raw.toLowerCase());
}
