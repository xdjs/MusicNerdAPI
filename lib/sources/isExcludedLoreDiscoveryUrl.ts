import { LORE_EXCLUDED_DISCOVERY_HOSTS } from "@/lib/sources/const";

/**
 * Whether automatic Lore discovery must skip this URL (LinkedIn). Sources the
 * artist submits deliberately keep their own policy.
 *
 * @param url - A candidate URL.
 * @returns True for LinkedIn hosts; false otherwise, including for invalid URLs.
 */
export function isExcludedLoreDiscoveryUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    return LORE_EXCLUDED_DISCOVERY_HOSTS.some(
      domain => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    // Invalid URLs belong to the URL-safety gate.
    return false;
  }
}
