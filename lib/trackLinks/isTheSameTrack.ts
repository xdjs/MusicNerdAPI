import { creditedNames } from "@/lib/trackLinks/creditedNames";
import { foldTrackText } from "@/lib/trackLinks/foldTrackText";
import { normTrackText } from "@/lib/trackLinks/normTrackText";
import { versionCredits } from "@/lib/trackLinks/versionCredits";

/**
 * Is this search hit the song we asked for? The title has to match outright:
 * a near-match is a different song. The artist test is two tests, neither a
 * substring check (which accepts "Dave East" for "Dave"): the artist is one
 * of the people credited, or their name sits inside a bracketed version
 * credit of the title, as on their own remix.
 *
 * @param hitTitle - The provider's title.
 * @param hitArtist - The provider's artist credit.
 * @param wantTitle - The title asked for.
 * @param wantArtist - The artist asked for.
 * @returns True when the hit is the record asked for.
 */
export function isTheSameTrack(
  hitTitle: string,
  hitArtist: string,
  wantTitle: string,
  wantArtist: string,
): boolean {
  // An empty fold on either side means there was nothing comparable in it.
  if (!foldTrackText(wantTitle) || foldTrackText(hitTitle) !== foldTrackText(wantTitle))
    return false;
  const artist = normTrackText(wantArtist);
  if (!artist) return false;
  // The whole credit first, BEFORE splitting it: "Earth, Wind & Fire" is one
  // band whose name contains two of the separators.
  if (normTrackText(hitArtist) === artist) return true;
  if (creditedNames(hitArtist).includes(artist)) return true;
  // The title exception, narrowed to a bracketed version credit so an artist
  // called Rango does not take a stranger's "Rango Sessions".
  return versionCredits(wantTitle).some(seg => {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(seg);
  });
}
