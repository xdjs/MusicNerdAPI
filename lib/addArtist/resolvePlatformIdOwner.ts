import { and, eq } from "drizzle-orm";
import { toAddArtistCandidate } from "@/lib/addArtist/toAddArtistCandidate";
import type { AddArtistCandidate, PlatformIdOwnerResolution } from "@/lib/addArtist/types";
import { artistIdMappings, artists } from "@/lib/db/schema";
import type { MusicPlatform } from "@/lib/musicPlatform/types";
import type { TransactionDb } from "@/lib/ownership/types";

const columns = { id: true, name: true, spotify: true, deezer: true, customImage: true } as const;

/**
 * Which artist holds a platform id, through the artist's own column or an id
 * mapping. A direct holder and a different mapped holder, or a mapped artist
 * whose own column names another id, is a conflict.
 *
 * @param database - The add's transaction.
 * @param platform - `spotify` or `deezer`.
 * @param platformId - The id.
 * @returns none, the owner, or the conflicting candidates.
 */
export async function resolvePlatformIdOwner(
  database: Pick<TransactionDb, "query">,
  platform: MusicPlatform,
  platformId: string,
): Promise<PlatformIdOwnerResolution> {
  const directColumn = platform === "deezer" ? artists.deezer : artists.spotify;
  const [directOwner, mapping] = await Promise.all([
    database.query.artists.findFirst({ where: eq(directColumn, platformId), columns }),
    database.query.artistIdMappings.findFirst({
      where: and(
        eq(artistIdMappings.platform, platform),
        eq(artistIdMappings.platformId, platformId),
      ),
      columns: { artistId: true },
    }),
  ]);
  if (!mapping)
    return directOwner
      ? { status: "owner", owner: toAddArtistCandidate(directOwner) }
      : { status: "none" };
  if (directOwner?.id === mapping.artistId)
    return { status: "owner", owner: toAddArtistCandidate(directOwner) };

  const mappedOwner = await database.query.artists.findFirst({
    where: eq(artists.id, mapping.artistId),
    columns,
  });
  const mapped: AddArtistCandidate = mappedOwner
    ? toAddArtistCandidate(mappedOwner)
    : { id: mapping.artistId, name: null, spotify: null, deezer: null };
  const mappedOwnId = platform === "deezer" ? mapped.deezer : mapped.spotify;
  if (directOwner || (mappedOwnId?.trim() && mappedOwnId !== platformId))
    return {
      status: "conflict",
      candidates: directOwner ? [toAddArtistCandidate(directOwner), mapped] : [mapped],
    };
  return { status: "owner", owner: mapped };
}
