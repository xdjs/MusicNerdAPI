import type { ExtractedArtistId } from "@/lib/artists/types";

/**
 * The first capture group as the id, percent-decoded. SoundCloud prefers group
 * 2, because its group 1 is the optional literal "www.".
 *
 * @param siteName - The urlmap row's platform.
 * @param match - The urlmap regex match.
 * @param cardPlatformName - The row's display name.
 * @returns The reading, or null when there is no usable id.
 */
export function genericArtistId(
  siteName: string,
  match: RegExpMatchArray,
  cardPlatformName: string | null,
): ExtractedArtistId | null {
  let id = siteName === "soundcloud" ? match[2] || match[1] : match[1] || match[2] || match[3];
  try {
    if (id) id = decodeURIComponent(id);
  } catch {
    // Not valid percent-encoding; keep it as captured.
  }
  if (siteName === "x" && id?.includes("?")) id = id.split("?")[0];
  // Only usernames make a SoundCloud profile URL.
  if (siteName === "soundcloud" && /^\d+$/.test(id ?? "")) return null;
  if (siteName === "ens" && id) id = id.trim().toLowerCase();
  if (!id) return null;
  return { siteName, cardPlatformName, id };
}
