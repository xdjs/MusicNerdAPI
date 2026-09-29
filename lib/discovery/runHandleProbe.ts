import { isProbeHit } from "@/lib/discovery/isProbeHit";
import { stripHandleAndBoilerplate } from "@/lib/discovery/stripHandleAndBoilerplate";
import type { HandleProbe, ProbeHit } from "@/lib/discovery/types";
import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";
import { foldName } from "@/lib/text/foldName";

/**
 * Probes one (platform, handle) URL. A hit needs the artist's name in what's
 * left of the title after the handle and boilerplate are stripped; nothing
 * left is a miss. An image with no usable title counts only for a confirmed
 * handle, never a guess.
 *
 * A platform that serves its own name as the title with an image is a login
 * wall or a rate limit, not an absent profile: it's recorded in `walled` so
 * the caller can say "couldn't check" rather than "not found".
 *
 * @param probe - What to probe.
 * @param urlmapBySiteName - urlmap rows by column, for the URL template.
 * @param artistName - The resolved name.
 * @param walled - Collects walled platforms.
 * @returns The hit, or null; never throws.
 */
export async function runHandleProbe(
  probe: HandleProbe,
  urlmapBySiteName: Map<string, UrlmapPresentationRow>,
  artistName: string,
  walled?: Set<ProfileDisplayColumn>,
): Promise<ProbeHit | null> {
  const row = urlmapBySiteName.get(probe.platform);
  if (!row?.appStringFormat) return null;
  const url = row.appStringFormat.replace("%@", probe.handle);
  try {
    const preview = await fetchLinkPreview(url);
    const residual = preview.title ? stripHandleAndBoilerplate(preview.title, probe.handle) : "";
    const platformName = row.cardPlatformName ?? probe.platform;
    if (residual && preview.imageUrl && foldName(residual) === foldName(platformName)) {
      console.warn(
        `[profileDiscovery] ${probe.platform} served its own name as the page title for @${probe.handle} — a wall or a rate limit, not evidence this handle is absent`,
      );
      walled?.add(probe.platform);
    }
    if (residual) {
      if (!isProbeHit({ imageUrl: preview.imageUrl, title: residual }, artistName)) return null;
      return { url, preview };
    }
    if (probe.confirmed && preview.imageUrl) return { url, preview };
    return null;
  } catch (e) {
    console.error(`[profileDiscovery] tier3 handle probe failed for ${url}:`, e);
    return null;
  }
}
