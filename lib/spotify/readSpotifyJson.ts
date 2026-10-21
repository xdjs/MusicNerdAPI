import type { SpotifyHeaders } from "@/lib/spotify/types";
import { fetchSpotifyResponse } from "./fetchSpotifyResponse";

/**
 * One Spotify Web API GET.
 *
 * @param url - The endpoint.
 * @param headers - Bearer headers from `getSpotifyHeaders`.
 * @param transport - What sends the request; `fetch` unless the caller needs another.
 * @returns The parsed body. Throws on a non-2xx status.
 */
export async function readSpotifyJson(
  url: string,
  headers: SpotifyHeaders,
  transport: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchSpotifyResponse(url, { headers: headers.headers }, transport);
  if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
  return res.json();
}
