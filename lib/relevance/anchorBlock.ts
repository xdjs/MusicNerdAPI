import type { ArtistAnchor } from "@/lib/relevance/types";

/**
 * The anchor as the judge reads it: name, then up to 12 verified releases and 12 confirmed accounts.
 *
 * @param anchor - What we can prove about the artist.
 * @returns The block's lines.
 */
export function anchorBlock(anchor: ArtistAnchor): string {
  const lines = [`NAME: ${anchor.name}`];
  if (anchor.catalog?.length)
    lines.push(`VERIFIED RELEASES: ${anchor.catalog.slice(0, 12).join(", ")}`);
  if (anchor.identifiers?.length)
    lines.push(`CONFIRMED ACCOUNTS: ${anchor.identifiers.slice(0, 12).join(", ")}`);
  return lines.join("\n");
}
