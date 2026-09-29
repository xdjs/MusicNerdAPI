import { BLOCKED_HOSTS } from "@/lib/sources/const";
import { hostOf } from "@/lib/sources/hostOf";
import { matchesHost } from "@/lib/sources/matchesHost";

/**
 * Whether a URL is kept out of the vault entirely: a host with no author,
 * whose every page is generated from a scrape or a catalogue feed. Checked
 * before a page is fetched. URLs the artist hands us are not checked.
 *
 * @param url - A candidate URL.
 * @returns True when the host (or a subdomain of it) is blocked.
 */
export function isBlockedSourceHost(url: string): boolean {
  const host = hostOf(url);
  return !!host && matchesHost(host, url, BLOCKED_HOSTS);
}
