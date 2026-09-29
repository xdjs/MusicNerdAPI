import type { SpotifyHeaders } from "@/lib/spotify/types";

/**
 * One Spotify Web API GET.
 *
 * @param url - The endpoint.
 * @param headers - Bearer headers from `getSpotifyHeaders`.
 * @returns The parsed body. Throws on a non-2xx status.
 */
export async function readSpotifyJson(
  url: string,
  headers: SpotifyHeaders,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: headers.headers });
  if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
  return res.json();
}
