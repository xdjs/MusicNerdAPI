import { BANDCAMP_RESERVED_SUBDOMAINS } from "@/lib/discovery/const";

/**
 * Is this one of Bandcamp's own subdomains (blog, daily, …) rather than an
 * artist's? `blog.bandcamp.com` surfaced live for an unrelated artist.
 *
 * @param rawUrl - The URL.
 * @returns True for a reserved subdomain.
 */
export function isReservedBandcampSubdomain(rawUrl: string): boolean {
  try {
    return BANDCAMP_RESERVED_SUBDOMAINS.has(new URL(rawUrl).hostname.toLowerCase().split(".")[0]);
  } catch {
    return false;
  }
}
