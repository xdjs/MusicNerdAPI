import { PLATFORM_DOMAINS, PROFILE_LINK_COLUMNS } from "@/lib/artists/const";
import { artistRowProperty } from "@/lib/artists/artistRowProperty";
import { IDENTITY_MATCH_MIN_LENGTH } from "@/lib/vault/const";
import { identifyingPart } from "@/lib/vault/identifyingPart";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

/**
 * Whether a search result is a profile we already hold as a link: identity we
 * have, not research. The stored handle has to appear on its own platform. A
 * bare substring test discarded dupes.rocks, an artist's own site, because his
 * Bandcamp handle is "dupes".
 *
 * @param url - The search result.
 * @param artist - The artist row, read by row property (`facebookID` is `facebookId`).
 * @returns True when the url is one of the artist's stored profiles.
 */
export function isKnownProfileUrl(url: string, artist: Record<string, unknown>): boolean {
  const destination = parseMusicDestination(url);
  if (destination?.kind === "release") return false;
  if (destination?.platform === "spotify") {
    const held = artist.spotify;
    if (typeof held !== "string") return false;
    const parsed = parseMusicDestination(held);
    return (
      destination.id ===
      (parsed?.platform === "spotify" && parsed.kind === "artist" ? parsed.id : held.trim())
    );
  }
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const haystack = url.toLowerCase();
  return PROFILE_LINK_COLUMNS.some(col => {
    const value = artist[artistRowProperty(col)];
    if (typeof value !== "string") return false;
    const v = identifyingPart(value);
    if (v.length < IDENTITY_MATCH_MIN_LENGTH) return false;
    const domains = PLATFORM_DOMAINS[col];
    if (!domains?.some(d => host === d || host.endsWith(`.${d}`))) return false;
    return haystack.includes(v);
  });
}
