import { extractArtistId } from "@/lib/artists/extractArtistId";
import { MAX_CANDIDATES_PER_PLATFORM, OG_RELIABLE_SITENAMES } from "@/lib/discovery/const";
import { stripUrlQuery } from "@/lib/discovery/stripUrlQuery";
import type { DiscoveredProfile, TierCandidate, ValidationContext } from "@/lib/discovery/types";
import { artistHasRawLinkValue } from "@/lib/links/artistHasRawLinkValue";
import { buildLinkPresentationMeta } from "@/lib/links/buildLinkPresentationMeta";
import { PROFILE_DISPLAY_COLUMNS } from "@/lib/links/const";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";

/**
 * Every gate a candidate clears before an artist sees it: it resolves (query
 * stripped) to the platform the tier proposed, on a card column the artist
 * hasn't filled, within the per-platform cap. The canonical URL is used only
 * if it round-trips to the same id. A tier-4 hit on a platform that reliably
 * serves og:image must have one; tiers 1–3 never hallucinate a URL.
 *
 * @param candidate - The tier's proposal.
 * @param ctx - The run's validation context.
 * @returns The profile card, or null.
 */
export async function validateCandidate(
  candidate: TierCandidate,
  ctx: ValidationContext,
): Promise<DiscoveredProfile | null> {
  let extracted;
  try {
    extracted = await extractArtistId(stripUrlQuery(candidate.url));
  } catch (e) {
    console.error(`[profileDiscovery] extractArtistId threw for ${candidate.url}:`, e);
    return null;
  }
  if (!extracted?.siteName || !extracted?.id) return null;
  const siteName = extracted.siteName;
  if (siteName !== candidate.platform) return null;
  if (!(PROFILE_DISPLAY_COLUMNS as readonly string[]).includes(siteName)) return null;
  if (artistHasRawLinkValue(ctx.record, siteName)) return null;
  const already = ctx.seen.get(siteName) ?? 0;
  if (already >= MAX_CANDIDATES_PER_PLATFORM) return null;
  ctx.seen.set(siteName, already + 1);

  const meta = buildLinkPresentationMeta(
    ctx.urlmapBySiteName.get(siteName),
    siteName,
    extracted.id,
  );
  let profileUrl = meta.profileUrl || candidate.url;
  if (meta.profileUrl) {
    try {
      const roundTrip = await extractArtistId(meta.profileUrl);
      if (!roundTrip || roundTrip.siteName !== siteName || roundTrip.id !== extracted.id)
        profileUrl = candidate.url;
    } catch {
      profileUrl = candidate.url;
    }
  }
  const preview = candidate.preview ?? (await fetchLinkPreview(profileUrl));
  const previewImage = preview.imageUrl ?? null;
  if (!previewImage && candidate.tier === 4 && OG_RELIABLE_SITENAMES.has(siteName)) return null;
  return {
    siteName,
    displayName: meta.displayName,
    value: extracted.id,
    profileUrl,
    logoUrl: meta.logoUrl,
    colorHex: meta.colorHex,
    previewImage,
    reasoning: candidate.reasoning,
    provisional: candidate.provisional ?? false,
  };
}
