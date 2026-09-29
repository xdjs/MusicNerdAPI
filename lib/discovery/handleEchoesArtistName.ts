import { deleetHandle } from "@/lib/discovery/deleetHandle";
import { foldName } from "@/lib/text/foldName";

/**
 * Does a search-found handle echo the artist's name, either direction,
 * leetspeak tolerated? The primary check for tier 4: a same-surname stranger's
 * page title can contain the name while the handle ("inoise") has nothing to
 * do with it.
 *
 * @param handle - The resolved handle.
 * @param artistName - The artist's name.
 * @returns True when one contains the other.
 */
export function handleEchoesArtistName(handle: string, artistName: string): boolean {
  const normArtist = foldName(artistName);
  if (!normArtist) return false;
  for (const candidate of [handle, deleetHandle(handle)]) {
    const normHandle = foldName(candidate);
    if (normHandle && (normHandle.includes(normArtist) || normArtist.includes(normHandle)))
      return true;
  }
  return false;
}
