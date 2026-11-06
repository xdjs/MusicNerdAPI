import { artistRelationIds } from "@/lib/musicbrainz/artistRelationIds";
import { activeRelations } from "@/lib/musicbrainz/activeRelations";
import { COUNTERPART_BUDGET_MS, COUNTERPART_REQUEST_TIMEOUT_MS } from "@/lib/musicbrainz/const";
import { isMusicBrainzPlatformId } from "@/lib/musicbrainz/isMusicBrainzPlatformId";
import { matchPlatformArtistUrl } from "@/lib/musicbrainz/matchPlatformArtistUrl";
import { platformArtistUrl } from "@/lib/musicbrainz/platformArtistUrl";
import { requestMusicBrainz } from "@/lib/musicbrainz/requestMusicBrainz";
import { sinceLastCall } from "@/lib/musicbrainz/sinceLastCall";
import type { MusicBrainzCounterpart } from "@/lib/musicbrainz/types";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

/**
 * An artist's id on the other catalog platform, from the exact source URL
 * MusicBrainz stores, as MusicNerdWeb resolved it when adding an artist. No
 * name search: the source URL must belong to one MusicBrainz artist, that
 * artist must hold exactly one URL for each platform, and the target URL must
 * belong to that same artist. Any malformed or ambiguous answer abstains. The
 * caller still verifies the id with the platform. Bounded by one budget,
 * because a user is waiting.
 *
 * @param sourcePlatform - The platform the artist was submitted from.
 * @param sourcePlatformId - Their id there.
 * @param targetPlatform - The other platform.
 * @returns The target id and the MusicBrainz id, or null. Never throws.
 */
export async function findMusicBrainzCounterpart(
  sourcePlatform: MusicPlatform,
  sourcePlatformId: string,
  targetPlatform: MusicPlatform,
): Promise<MusicBrainzCounterpart | null> {
  if (
    sourcePlatform === targetPlatform ||
    !isMusicBrainzPlatformId(sourcePlatform, sourcePlatformId)
  )
    return null;
  const deadline = Date.now() + COUNTERPART_BUDGET_MS;
  const timeout = () =>
    Math.max(1, Math.min(COUNTERPART_REQUEST_TIMEOUT_MS, deadline - Date.now()));
  const owners = async (resource: string) => {
    if (!(await sinceLastCall(deadline))) return null;
    const params = new URLSearchParams({ resource, inc: "artist-rels", fmt: "json" });
    const result = await requestMusicBrainz(`/url?${params.toString()}`, timeout());
    if (result.status !== "ok") return null;
    const ids = artistRelationIds(result.data);
    return ids.status === "ok" ? ids.ids : null;
  };

  const sourceUrl = platformArtistUrl(sourcePlatform, sourcePlatformId);
  const sourceOwners = await owners(sourceUrl);
  if (sourceOwners?.size !== 1) return null;
  const musicbrainzId = [...sourceOwners][0];

  if (!(await sinceLastCall(deadline))) return null;
  const detailResult = await requestMusicBrainz(
    `/artist/${musicbrainzId}?${new URLSearchParams({ inc: "url-rels", fmt: "json" }).toString()}`,
    timeout(),
  );
  const detail = detailResult.status === "ok" ? detailResult.data : null;
  if (detail?.id !== musicbrainzId) return null;
  const relations = activeRelations(detail);
  if (relations.status === "invalid") return null;

  const relationUrls: string[] = [];
  for (const relation of relations.relations) {
    const url = relation.url;
    const resource =
      url && typeof url === "object" && !Array.isArray(url)
        ? (url as Record<string, unknown>).resource
        : undefined;
    if (relation["target-type"] !== "url" || typeof resource !== "string") return null;
    try {
      new URL(resource);
    } catch {
      return null;
    }
    relationUrls.push(resource);
  }
  const platformRelations = relationUrls.map(url => ({
    url,
    source: matchPlatformArtistUrl(url, sourcePlatform),
    target: matchPlatformArtistUrl(url, targetPlatform),
  }));
  if (platformRelations.some(r => r.source.status === "invalid" || r.target.status === "invalid"))
    return null;

  // The entry must hold exactly the URL just verified for the source platform.
  const sourceUrls = new Set(
    platformRelations
      .filter(r => r.source.status === "valid")
      .map(r => (r.source.status === "valid" ? `${r.source.platformId} ${r.url}` : "")),
  );
  if (sourceUrls.size !== 1 || !sourceUrls.has(`${sourcePlatformId} ${sourceUrl}`)) return null;

  const targets = new Map<string, Set<string>>();
  for (const r of platformRelations)
    if (r.target.status === "valid")
      targets.set(r.target.platformId, (targets.get(r.target.platformId) ?? new Set()).add(r.url));
  if (targets.size !== 1) return null;
  const [[platformId, targetUrls]] = [...targets];
  if (targetUrls.size !== 1) return null;

  const targetOwners = await owners([...targetUrls][0]);
  if (targetOwners?.size !== 1 || !targetOwners.has(musicbrainzId)) return null;
  return { platformId, musicbrainzId };
}
