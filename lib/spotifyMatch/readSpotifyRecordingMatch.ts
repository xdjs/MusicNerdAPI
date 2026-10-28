import type { SpotifyHeaders } from "@/lib/spotify/types";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";
import type { RecordingMatch } from "./types";

/** Read every bounded exact-ISRC credit; partial results cannot verify an identity. */
export async function readSpotifyRecordingMatch(
  isrc: string,
  signal: AbortSignal,
  authorization?: SpotifyHeaders,
): Promise<RecordingMatch> {
  const { headers } = authorization ?? (await getSpotifyHeaders());
  signal.throwIfAborted();
  const response = await fetchSpotifyResponse(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(`isrc:${isrc}`)}&type=track&limit=10&market=US`,
    { headers, signal },
  );
  if (!response.ok) throw new Error(`Spotify returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body?.tracks?.items)) throw new Error("Invalid Spotify recording response");
  let incomplete =
    Number(body.tracks.total ?? 0) > 10 ||
    body.tracks.items.length > 10 ||
    Boolean(body.tracks.next);
  const artists = new Map<string, { id: string; name: string }>();
  for (const track of body.tracks.items.slice(0, 10)) {
    if (String(track?.external_ids?.isrc ?? "").toUpperCase() !== isrc) continue;
    if (Array.isArray(track.artists) && track.artists.length > 10) incomplete = true;
    for (const artist of Array.isArray(track.artists) ? track.artists.slice(0, 10) : []) {
      if (/^[A-Za-z0-9]{22}$/.test(artist?.id ?? "") && typeof artist?.name === "string")
        artists.set(artist.id, { id: artist.id, name: artist.name.slice(0, 500) });
    }
  }
  if (artists.size > 50) throw new Error("Spotify recording credits exceed match budget");
  return { isrc, artists: [...artists.values()], ...(incomplete ? { incomplete: true } : {}) };
}
