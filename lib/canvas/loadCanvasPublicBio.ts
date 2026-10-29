import { getArtistById } from "@/lib/artists/getArtistById";
import { getLoreClaimGeneration } from "@/lib/ownership/getLoreClaimGeneration";
import { getPublicArtistAbout } from "@/lib/bio/getPublicArtistAbout";
import { isRealBio } from "@/lib/bio/isRealBio";
/** Read exactly the claimed bio or eligible directory About used by the public profile. */
export async function loadCanvasPublicBio(artistId: string) {
  const artist = await getArtistById(artistId);
  if (!artist) return null;
  const claim = await getLoreClaimGeneration(artistId);
  const about = claim ? null : await getPublicArtistAbout(artistId);
  const bio = claim && isRealBio(artist.bio) ? artist.bio : about?.bio;
  if (!bio) return null;
  return {
    bio,
    name: artist.name ?? "Artist",
    url: `https://app-git-codex-intent-exploration-musicnerd.vercel.app/artist/${artistId}?view=profile`,
  };
}
