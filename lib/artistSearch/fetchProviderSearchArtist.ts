import { ProviderSearchUnavailableError } from "@/lib/artistSearch/ProviderSearchUnavailableError";
import type { ExternalSearchArtistResult } from "@/lib/artistSearch/types";
import { DEEZER_API, DEEZER_TIMEOUT_MS } from "@/lib/musicPlatform/const";
import type { MusicPlatform } from "@/lib/musicPlatform/types";
import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";

/** One direct identity read. Only confirmed absence becomes null; failures stay unavailable. */
export async function fetchProviderSearchArtist(
  platform: MusicPlatform,
  platformId: string,
): Promise<ExternalSearchArtistResult | null> {
  try {
    const response =
      platform === "spotify"
        ? await fetchSpotifyResponse(`https://api.spotify.com/v1/artists/${platformId}`, {
            headers: (await getSpotifyHeaders()).headers,
            redirect: "error",
          })
        : await fetch(`${DEEZER_API}/artist/${platformId}`, {
            signal: AbortSignal.timeout(DEEZER_TIMEOUT_MS),
            cache: "no-store",
            redirect: "error",
          });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Provider HTTP failure");
    const data = await response.json();
    if (platform === "deezer" && data?.error?.code === 800) return null;
    if (
      data?.error ||
      !data ||
      String(data.id) !== platformId ||
      typeof data.name !== "string" ||
      !data.name.trim()
    )
      throw new Error("Invalid provider artist");
    const image = platform === "spotify" ? data.images?.[0]?.url : data.picture_xl;
    return {
      id: null,
      name: data.name,
      platform,
      platformId,
      imageUrl: typeof image === "string" ? image : null,
      profileUrl:
        platform === "spotify"
          ? `https://open.spotify.com/artist/${platformId}`
          : `https://www.deezer.com/artist/${platformId}`,
      isExternalOnly: true,
      matchScore: 0,
      linkCount: 0,
    };
  } catch {
    throw new ProviderSearchUnavailableError(platform);
  }
}
