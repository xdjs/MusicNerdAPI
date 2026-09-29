import {
  AGGREGATOR_HOSTS,
  AUTHORITY,
  BLOCKED_HOSTS,
  CATALOGUE_HOSTS,
  CREDITS_HOSTS,
} from "@/lib/sources/const";
import { hostOf } from "@/lib/sources/hostOf";
import { matchesHost } from "@/lib/sources/matchesHost";

/**
 * Ranks one source. An interview or review is editorial wherever it ran: that
 * comes from the page type, not from a list of publications we have heard of.
 *
 * @param url - The source's URL.
 * @param type - The source's type ("interview", "article", …), when known.
 * @param opts - Extra facts the caller knows.
 * @param opts.ownDomain - The URL is the artist's own site.
 * @returns The rank; higher is better.
 */
export function sourceAuthority(
  url: string,
  type?: string | null,
  opts?: { ownDomain?: boolean },
): number {
  const host = hostOf(url);
  if (!host) return AUTHORITY.UNKNOWN;

  if (opts?.ownDomain) return AUTHORITY.OWN_SITE;
  if (matchesHost(host, url, CREDITS_HOSTS)) return AUTHORITY.CREDITS;
  if (matchesHost(host, url, BLOCKED_HOSTS) || matchesHost(host, url, AGGREGATOR_HOSTS))
    return AUTHORITY.AGGREGATOR;
  if (host === "instagram.com" || host === "x.com" || host === "twitter.com")
    return AUTHORITY.OWN_WORDS;
  if (matchesHost(host, url, CATALOGUE_HOSTS)) return AUTHORITY.CATALOGUE;
  if (type === "interview" || type === "review" || type === "article") return AUTHORITY.EDITORIAL;
  return AUTHORITY.UNKNOWN;
}
