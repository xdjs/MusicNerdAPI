import { foldName } from "@/lib/text/foldName";
import { OWN_DOMAIN_SUFFIXES, TWO_PART_TLDS } from "@/lib/vault/const";

/**
 * Is this the artist's own site, rather than a site with their name in it? The
 * registrable domain's label must be their folded name plus an optional
 * musician's suffix: peterango.com passes; peterango-fans.example and
 * peterango.attacker.example don't. (A substring test let anyone register a
 * fan domain and have its handles adopted.)
 *
 * @param url - The page URL.
 * @param artistName - The artist's name.
 * @returns True when the URL is on the artist's own domain.
 */
export function isArtistOwnDomain(url: string, artistName: string): boolean {
  const name = foldName(artistName);
  if (name.length < 5) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    if (parts.length < 2) return false;
    const twoPartTld = TWO_PART_TLDS.has(parts.slice(-2).join("."));
    const registrable = parts.slice(twoPartTld ? -3 : -2);
    if (registrable.length < (twoPartTld ? 3 : 2)) return false;
    // A subdomain is the registrant's choice and says nothing about who they are.
    if (parts.length > registrable.length) return false;
    const label = foldName(registrable[0] ?? "");
    return OWN_DOMAIN_SUFFIXES.some(s => label === name + s);
  } catch {
    return false;
  }
}
