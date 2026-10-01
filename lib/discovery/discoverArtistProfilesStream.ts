import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { getAllLinks } from "@/lib/artists/getAllLinks";
import { getArtistById } from "@/lib/artists/getArtistById";
import type { UrlMapRow } from "@/lib/artists/types";
import { DISCOVERY_BUDGET_MS } from "@/lib/discovery/const";
import { handleProbeEvents } from "@/lib/discovery/handleProbeEvents";
import { idMappingEvents } from "@/lib/discovery/idMappingEvents";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { platformSearchEvents } from "@/lib/discovery/platformSearchEvents";
import type { DiscoveryEvent, DiscoveryRun } from "@/lib/discovery/types";
import { webSearchEvents } from "@/lib/discovery/webSearchEvents";
import { artistHasRawLinkValue } from "@/lib/links/artistHasRawLinkValue";
import { PROFILE_DISPLAY_COLUMNS } from "@/lib/links/const";
import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";
import { getArtistPlatformData } from "@/lib/musicPlatform/getArtistPlatformData";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * Finds the profile-card platforms an artist hasn't linked, streamed as each
 * is found. Four tiers in authority order, each skipping what an earlier one
 * proposed: id mappings, Spotify/Deezer search, handle probes, web search.
 * Within a tier, platforms settle independently. Nothing here writes a link;
 * the artist confirms first.
 *
 * `DISCOVERY_BUDGET_MS` is checked between tiers: past it, the stream just
 * stops. Never throws once the activity is recorded; a failure ends the stream
 * with whatever was found.
 *
 * @param artistId - The artist.
 * @yields searching/checked pairs, found profiles, and unreachable platforms last.
 */
export async function* discoverArtistProfilesStream(
  artistId: string,
): AsyncGenerator<DiscoveryEvent> {
  await recordArtistActivity(artistId, "profile_discovery");
  const startedAt = Date.now();
  let artist;
  try {
    artist = await getArtistById(artistId);
  } catch (e) {
    console.error(`[profileDiscovery] getArtistById failed for ${artistId}:`, e);
    return;
  }
  if (!artist) return;
  const record = artist as unknown as Record<string, unknown>;
  const missing = new Set<ProfileDisplayColumn>(
    PROFILE_DISPLAY_COLUMNS.filter(col => !artistHasRawLinkValue(record, col)),
  );
  if (missing.size === 0) return;
  let urlmapRows: UrlMapRow[] = [];
  try {
    urlmapRows = await getAllLinks();
  } catch (e) {
    console.error("[profileDiscovery] getAllLinks failed, presentation metadata will degrade:", e);
  }
  const urlmapBySiteName = new Map<string, UrlmapPresentationRow>(
    urlmapRows.map(l => [l.siteName, l]),
  );
  const run: DiscoveryRun = {
    artistId,
    record,
    missing,
    urlmapBySiteName,
    ctx: { record, urlmapBySiteName, seen: new Map() },
    walled: new Set(),
    deadline: startedAt + DISCOVERY_BUDGET_MS,
    foundCount: 0,
  };

  yield* idMappingEvents(run);
  if (run.missing.size === 0 || Date.now() > run.deadline) return;
  // A bare platform id is no search anchor: resolve the real name first.
  let enrichment: MusicPlatformArtist | null = null;
  try {
    enrichment = await getArtistPlatformData(artist);
  } catch {
    enrichment = null;
  }
  const artistName = enrichment?.name?.trim() || artist.name?.trim() || null;
  if (!artistName) return;
  if (Date.now() <= run.deadline) yield* platformSearchEvents(run, artistName);
  if (run.missing.size > 0 && Date.now() <= run.deadline) yield* handleProbeEvents(run, artistName);
  if (run.missing.size > 0 && Date.now() <= run.deadline)
    yield* webSearchEvents(run, artistName, enrichment);

  // Said last, and only for what's still unresolved: a wall tier 4 got past isn't news.
  const stillWalled = [...run.walled].filter(p => run.missing.has(p));
  for (const platform of stillWalled)
    yield platformEvent("unreachable", platform, urlmapBySiteName);
  console.log(
    `[profileDiscovery] artist=${artistId} name="${artist.name ?? artistName}" found=${run.foundCount} elapsedMs=${Date.now() - startedAt}${stillWalled.length ? ` unreachable=${stillWalled.join(",")}` : ""}`,
  );
}
