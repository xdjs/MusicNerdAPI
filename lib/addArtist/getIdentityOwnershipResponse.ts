import { dedupeAddArtistCandidates } from "@/lib/addArtist/dedupeAddArtistCandidates";
import { reciprocalSourceLabel } from "@/lib/addArtist/reciprocalSourceLabel";
import type {
  AddArtistBody,
  AddArtistCandidate,
  ArtistPlatformIdentity,
  PlatformIdOwnerResolution,
} from "@/lib/addArtist/types";
import type { ReciprocalArtistIdentity } from "@/lib/catalogIdentity/types";

/**
 * What to answer when either platform id is already taken, as MusicNerdWeb
 * decided it: conflicting records or two different owners are a conflict; the
 * submitted id's owner already exists; the other platform's owner is offered
 * as the same artist (and a forced separate add is refused).
 *
 * @param params - The identities and who holds each.
 * @param params.submittedIdentity - The submitted platform and id.
 * @param params.submittedOwnership - Who holds the submitted id.
 * @param params.reciprocalIdentity - The verified other-platform id, if any.
 * @param params.reciprocalOwnership - Who holds that id.
 * @param params.forceCreate - The user asked for a separate artist.
 * @returns The answer, or null when neither id is taken.
 */
export function getIdentityOwnershipResponse(params: {
  submittedIdentity: ArtistPlatformIdentity;
  submittedOwnership: PlatformIdOwnerResolution;
  reciprocalIdentity: ReciprocalArtistIdentity | null;
  reciprocalOwnership: PlatformIdOwnerResolution;
  forceCreate: boolean;
}): AddArtistBody | null {
  const { submittedIdentity, reciprocalIdentity, forceCreate } = params;
  const { platform, platformId } = submittedIdentity;
  const ownerships = [params.submittedOwnership, params.reciprocalOwnership];
  const conflicts = ownerships.flatMap(o => (o.status === "conflict" ? o.candidates : []));
  if (ownerships.some(o => o.status === "conflict"))
    return {
      result: "conflict",
      candidates: dedupeAddArtistCandidates(conflicts),
      platform,
      platformId,
      message: "Those platform profiles are assigned to conflicting artist records",
    };

  const ownerOf = (o: PlatformIdOwnerResolution): AddArtistCandidate | null =>
    o.status === "owner" ? o.owner : null;
  const submittedOwner = ownerOf(params.submittedOwnership);
  const reciprocalOwner = ownerOf(params.reciprocalOwnership);
  if (submittedOwner && reciprocalOwner && submittedOwner.id !== reciprocalOwner.id)
    return {
      result: "conflict",
      candidates: dedupeAddArtistCandidates([submittedOwner, reciprocalOwner]),
      platform,
      platformId,
      message: "The matching Spotify and Deezer profiles belong to different artist records",
    };
  if (submittedOwner)
    return {
      result: "exists",
      artistId: submittedOwner.id,
      artistName: submittedOwner.name ?? "",
      message: "That artist is already in our database",
    };
  if (reciprocalOwner && reciprocalIdentity) {
    if (forceCreate)
      return {
        result: "conflict",
        candidates: [reciprocalOwner],
        platform,
        platformId,
        message: `The matching ${reciprocalIdentity.platform} profile already belongs to another artist`,
      };
    return {
      result: "possible_duplicate",
      candidates: [reciprocalOwner],
      platform,
      platformId,
      canCreateSeparate: false,
      message: `${reciprocalSourceLabel(reciprocalIdentity)} links this profile to an existing artist's ${reciprocalIdentity.platform} profile. Add the submitted link to that artist.`,
    };
  }
  return null;
}
