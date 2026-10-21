import type { ArtistRow } from "@/lib/artists/types";
import type { ArtistSummary } from "@/lib/mcp/types";

/**
 * The id and name `search_artists` returns, nothing else.
 *
 * @param artist - The artist row (a search row carries at least id and name).
 * @returns The summary; a null name becomes "".
 */
export function toArtistSummary(artist: Pick<ArtistRow, "id" | "name">): ArtistSummary {
  return {
    id: artist.id,
    name: artist.name ?? "",
  };
}
