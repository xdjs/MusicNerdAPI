import { activeRelations } from "@/lib/musicbrainz/activeRelations";
import type { ArtistRelationIdsResult } from "@/lib/musicbrainz/types";

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The MusicBrainz artists a URL entry belongs to.
 *
 * @param data - The URL entry, looked up with `inc=artist-rels`.
 * @returns The artists' ids, or invalid when any active relation is not a well-formed artist.
 */
export function artistRelationIds(data: Record<string, unknown> | null): ArtistRelationIdsResult {
  const active = activeRelations(data);
  if (active.status === "invalid") return active;
  const ids = new Set<string>();
  for (const relation of active.relations) {
    if (relation["target-type"] !== "artist") return { status: "invalid" };
    const artist = relation.artist;
    const id =
      artist && typeof artist === "object" && !Array.isArray(artist)
        ? (artist as Record<string, unknown>).id
        : undefined;
    if (typeof id !== "string" || !MBID.test(id)) return { status: "invalid" };
    ids.add(id);
  }
  return { status: "ok", ids };
}
