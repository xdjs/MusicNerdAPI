import { sql } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";
import { ADD_ARTIST_CANDIDATE_LIMIT } from "@/lib/addArtist/const";
import { getIdentityOwnershipResponse } from "@/lib/addArtist/getIdentityOwnershipResponse";
import { queueDirectoryDiscovery } from "@/lib/addArtist/queueDirectoryDiscovery";
import { reciprocalSourceEvidence } from "@/lib/addArtist/reciprocalSourceEvidence";
import { resolvePlatformIdOwner } from "@/lib/addArtist/resolvePlatformIdOwner";
import { sortArtistPlatformIdentities } from "@/lib/addArtist/sortArtistPlatformIdentities";
import { toAddArtistCandidate } from "@/lib/addArtist/toAddArtistCandidate";
import type {
  AddArtistBody,
  AddArtistOutcome,
  ArtistPlatformIdentity,
  PlatformIdOwnerResolution,
  RefusedAddArtist,
} from "@/lib/addArtist/types";
import { acquireArtistNameLock } from "@/lib/artistLinks/acquireArtistNameLock";
import { acquirePlatformIdentityLock } from "@/lib/artistLinks/acquirePlatformIdentityLock";
import { normaliseArtistName } from "@/lib/artistLookups/normaliseArtistName";
import { findReciprocalArtistIdentity } from "@/lib/catalogIdentity/findReciprocalArtistIdentity";
import { getArtistIdentity } from "@/lib/catalogIdentity/getArtistIdentity";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

const RACE_ERROR =
  "The artist could not be created because another record changed at the same time. Please try again.";

/**
 * Adds an artist from a Spotify or Deezer id, as MusicNerdWeb's `addArtist`
 * did. The platform confirms the id and name; Wikidata or MusicBrainz may
 * supply the other platform's verified id. Under advisory locks on both ids
 * (and the name, unless forced) it answers with an existing owner, a conflict
 * or same-name candidates, or inserts the artist with both ids, records the
 * id mapping's provenance and queues directory research, in one transaction.
 *
 * @param userId - The signed-in user adding the artist.
 * @param input - The platform, the id and whether to add a separate artist despite a same-name one.
 * @param input.platform - `spotify` or `deezer`.
 * @param input.platformId - The submitted id.
 * @param input.forceCreate - Add a separate artist.
 * @returns The outcome, or a 404/409 refusal. Throws on anything else.
 */
export async function addArtist(
  userId: string,
  input: { platform: MusicPlatform; platformId: string; forceCreate: boolean },
): Promise<AddArtistOutcome | RefusedAddArtist> {
  const { platform, forceCreate } = input;
  const platformArtist = await getArtistIdentity(platform, input.platformId);
  const canonicalPlatformId = platformArtist?.platformId?.trim();
  if (!platformArtist?.name || !canonicalPlatformId)
    return { status: 404, error: `Could not find artist on ${platform}` };

  const reciprocalIdentity = await findReciprocalArtistIdentity({
    platform,
    platformId: canonicalPlatformId,
    name: platformArtist.name,
  });
  const submittedIdentity: ArtistPlatformIdentity = { platform, platformId: canonicalPlatformId };
  const identities = sortArtistPlatformIdentities([
    submittedIdentity,
    ...(reciprocalIdentity ? [reciprocalIdentity] : []),
  ]);
  const lcname = normaliseArtistName(platformArtist.name);
  let createdAt: string | null = null;

  const body = await db.transaction(async (tx): Promise<AddArtistBody | null> => {
    for (const identity of identities)
      await acquirePlatformIdentityLock(tx, identity.platform, identity.platformId);
    if (!forceCreate) await acquireArtistNameLock(tx, lcname);

    const ownershipResponse = async () => {
      const [submittedOwnership, reciprocalOwnership] = await Promise.all([
        resolvePlatformIdOwner(tx, platform, canonicalPlatformId),
        reciprocalIdentity
          ? resolvePlatformIdOwner(tx, reciprocalIdentity.platform, reciprocalIdentity.platformId)
          : Promise.resolve<PlatformIdOwnerResolution>({ status: "none" }),
      ]);
      const response = getIdentityOwnershipResponse({
        submittedIdentity,
        submittedOwnership,
        reciprocalIdentity,
        reciprocalOwnership,
        forceCreate,
      });
      return response?.result === "possible_duplicate"
        ? { ...response, artistName: platformArtist.name }
        : response;
    };

    const owned = await ownershipResponse();
    if (owned) return owned;

    if (!forceCreate) {
      const sameName = await tx.query.artists.findMany({
        where: eq(artists.lcname, lcname),
        orderBy: [asc(artists.createdAt), asc(artists.id)],
        limit: ADD_ARTIST_CANDIDATE_LIMIT,
        columns: { id: true, name: true, spotify: true, deezer: true, customImage: true },
      });
      if (sameName.length > 0)
        return {
          result: "possible_duplicate",
          candidates: sameName.map(toAddArtistCandidate),
          artistName: platformArtist.name,
          platform,
          platformId: canonicalPlatformId,
          message:
            "We found an artist with the same name. Choose the existing artist or confirm this is a different artist.",
        };
    }

    const platformIds: Partial<Record<MusicPlatform, string>> = { [platform]: canonicalPlatformId };
    if (reciprocalIdentity)
      platformIds[reciprocalIdentity.platform] = reciprocalIdentity.platformId;
    const [newArtist] = await tx
      .insert(artists)
      .values({ ...platformIds, lcname, name: platformArtist.name, addedBy: userId })
      .onConflictDoNothing()
      .returning();
    if (!newArtist) return (await ownershipResponse()) ?? null;

    // Mappings are Spotify-anchored: provenance always records the Deezer side of the pair.
    if (reciprocalIdentity && platformIds.deezer) {
      const reasoning = `${reciprocalSourceEvidence(reciprocalIdentity)} links Spotify and Deezer for ${platformArtist.name}`;
      await tx.execute(sql`
        INSERT INTO artist_id_mappings (artist_id, platform, platform_id, confidence, source, reasoning)
        VALUES (${newArtist.id}, 'deezer', ${platformIds.deezer}, 'high'::confidence_level,
          ${reciprocalIdentity.source}, ${reasoning})
      `);
    }
    await queueDirectoryDiscovery(tx, newArtist.id, userId);
    createdAt = newArtist.createdAt;
    return {
      result: "created",
      artistId: newArtist.id,
      artistName: newArtist.name ?? "",
      message: "Success! You can now find this artist in our directory",
    };
  });

  if (!body) return { status: 409, error: RACE_ERROR };
  return body.result === "created"
    ? { body, created: { createdAt, platformId: canonicalPlatformId } }
    : { body };
}
