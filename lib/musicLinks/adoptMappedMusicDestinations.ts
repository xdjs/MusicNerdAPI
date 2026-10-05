import { getArtistIdMappings } from "@/lib/discovery/getArtistIdMappings";
import { adoptMusicDestinations } from "@/lib/musicLinks/adoptMusicDestinations";
import type { SearchRun } from "@/lib/vault/types";

/** Existing high/manual-confidence IDs seed free catalog discovery without rewriting mappings. */
export async function adoptMappedMusicDestinations(run: SearchRun): Promise<void> {
  const urls: string[] = [];
  for (const mapping of await getArtistIdMappings(run.artistId)) {
    if (!["high", "manual"].includes(mapping.confidence)) continue;
    const id = mapping.platformId;
    if (mapping.platform === "apple_music" && /^[1-9]\d*$/.test(id))
      urls.push(`https://music.apple.com/artist/${id}`);
    if (mapping.platform === "tidal" && /^[1-9]\d*$/.test(id))
      urls.push(`https://tidal.com/artist/${id}`);
    if (mapping.platform === "amazon_music" && /^[A-Za-z0-9]{10}$/.test(id))
      urls.push(`https://music.amazon.com/artists/${id}`);
  }
  await adoptMusicDestinations(run, urls, "identifier");
}
