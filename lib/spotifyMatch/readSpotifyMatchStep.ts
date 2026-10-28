import { readSpotifyRecordingMatch } from "./readSpotifyRecordingMatch";
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
  const match = await readSpotifyRecordingMatch(isrc, signal);
  return { ...state, matches: [...(state.matches ?? []), match] };
}
