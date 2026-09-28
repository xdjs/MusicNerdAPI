import { normalizeLoose } from "@/lib/instagram/normalizeLoose";
import type { ApifyMusicInfo, ApifyPost } from "@/lib/instagram/types";

/**
 * The track a post credits, when it is a real third-party credit. musicInfo
 * is noisy: most video posts carry it, and it is often the artist's own
 * original audio. A credit naming the poster, by handle, display name or real
 * name, is dropped: we cannot tell "their own release" from "Instagram
 * mislabelled the audio", and keeping it once asked a real artist about a
 * collaboration he had no part in.
 *
 * @param raw - The Apify item.
 * @param ownerUsername - The post's owner.
 * @param selfNorm - The artist's handle, normalized.
 * @param realArtistName - The artist's real name, which a handle often is not.
 * @returns The title and artist, or both null.
 */
export function extractMusic(
  raw: ApifyPost,
  ownerUsername: string,
  selfNorm: string,
  realArtistName?: string,
): { musicTitle: string | null; musicArtist: string | null } {
  const none = { musicTitle: null, musicArtist: null };
  const info = raw.musicInfo as ApifyMusicInfo | undefined;
  if (!info || typeof info !== "object") return none;
  const songName = typeof info.song_name === "string" ? info.song_name.trim() : "";
  const artistName = typeof info.artist_name === "string" ? info.artist_name.trim() : "";
  if (!songName || !artistName) return none;
  if (info.uses_original_audio === true || songName.toLowerCase() === "original audio") return none;
  const credited = normalizeLoose(artistName);
  const isSelfCredit =
    credited === normalizeLoose(selfNorm) ||
    credited === normalizeLoose(ownerUsername) ||
    (!!realArtistName && credited === normalizeLoose(realArtistName));
  return isSelfCredit ? none : { musicTitle: songName, musicArtist: artistName };
}
