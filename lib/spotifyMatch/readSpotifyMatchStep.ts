import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { fetchSpotifyResponse } from "@/lib/spotify/fetchSpotifyResponse";
import type { SpotifyMatchState } from "./types";

/** One provider read per checkpoint; a failed or throttled request never becomes an empty result. */
export async function readSpotifyMatchStep(
  state: SpotifyMatchState,
  deadline: number,
): Promise<SpotifyMatchState> {
  const signal = AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now())));
  const phase = state.phase ?? "top";
  if (phase === "top" || phase === "deezer") {
    const track = state.trackIds?.[state.trackCursor ?? 0];
    if (phase === "deezer" && !track) return { ...state, phase: "spotify" };
    const url =
      phase === "top"
        ? `https://api.deezer.com/artist/${state.deezerId}/top?limit=5`
        : `https://api.deezer.com/track/${track}`;
    const response = await fetch(url, { signal, cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error(`Deezer returned ${response.status}`);
    const body = await response.json();
    if (!body || typeof body !== "object" || body.error)
      throw new Error("Invalid Deezer identity response");
    if (phase === "top") {
      if (!Array.isArray(body.data)) throw new Error("Invalid Deezer track list");
      const trackIds = [
        ...new Set<string>(
          body.data
            .slice(0, 5)
            .map((row: { id?: unknown }) => String(row?.id ?? ""))
            .filter((id: string) => /^\d+$/.test(id)),
        ),
      ];
      return {
        ...state,
        trackIds,
        trackCursor: 0,
        isrcs: [],
        matches: [],
        phase: trackIds.length ? "deezer" : "spotify",
      };
    }
    if (String(body.id ?? "") !== track) throw new Error("Unexpected Deezer recording identity");
    const isrc = typeof body.isrc === "string" ? body.isrc.toUpperCase() : "";
    const isrcs = [
      ...new Set([...(state.isrcs ?? []), ...(/^[A-Z0-9]{12}$/.test(isrc) ? [isrc] : [])]),
    ];
    const trackCursor = (state.trackCursor ?? 0) + 1;
    return {
      ...state,
      isrcs,
      trackCursor,
      phase: trackCursor >= (state.trackIds?.length ?? 0) ? "spotify" : "deezer",
    };
  }
  const done = new Set(state.matches?.map(match => match.isrc));
  const isrc = state.isrcs?.find(id => !done.has(id));
  if (!isrc) return state;
  const { headers } = await getSpotifyHeaders();
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
  return {
    ...state,
    matches: [
      ...(state.matches ?? []),
      { isrc, artists: [...artists.values()], ...(incomplete ? { incomplete: true } : {}) },
    ],
  };
}
