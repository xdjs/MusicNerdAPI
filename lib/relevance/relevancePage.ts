import { EXCERPT_CHARS } from "@/lib/relevance/const";
import { mentionDensity } from "@/lib/relevance/mentionDensity";
import type { ArtistAnchor, RelevanceCandidate } from "@/lib/relevance/types";
import { sourceTier } from "@/lib/sources/sourceTier";

/**
 * One numbered page as the judge reads it: title, the site's tier, how many
 * paragraphs name the artist, and an excerpt. The tier matters because what
 * gives away a stats dashboard is who publishes it, which isn't on the page.
 *
 * @param c - The page.
 * @param i - Its number in the batch.
 * @param anchor - The artist.
 * @returns The page block.
 */
export function relevancePage(c: RelevanceCandidate, i: number, anchor: ArtistAnchor): string {
  const density = mentionDensity(c.text ?? "", anchor.name, anchor.identifiers ?? []);
  const mentions = density
    ? `MENTIONS: names the artist in ${density.hits} of ${density.total} paragraphs`
    : `MENTIONS: unknown (no paragraph structure)`;
  const tier = `TIER: ${sourceTier(c.url, null, { ownDomain: c.ownDomain })}`;
  return `--- PAGE ${i} ---\nTITLE: ${c.title ?? "(none)"}\n${tier}\n${mentions}\n${(c.text ?? "").slice(0, EXCERPT_CHARS)}`;
}
