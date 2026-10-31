import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { isrcsFromDeezer } from "@/lib/musicPlatform/isrcsFromDeezer";
import { discoverDeezerCatalogCandidates } from "@/lib/musicPlatform/discoverDeezerCatalogCandidates";
import { readSpotifyRecordingMatch } from "@/lib/spotifyMatch/readSpotifyRecordingMatch";
import { chooseVerifiedSpotifyMatch } from "@/lib/spotifyMatch/chooseVerifiedSpotifyMatch";
import type { CatalogCounterpartResult } from "@/lib/musicPlatform/types";

/** Resolve either direction through distinct exact recording credits; a name search only supplies candidates. */
export async function resolveCatalogCounterpart(input: {
  artistName: string;
  spotifyId?: string;
  deezerId?: string;
}): Promise<CatalogCounterpartResult> {
  if (!input.artistName.trim() || (!input.spotifyId && !input.deezerId))
    return { status: "not_found" };
  if (
    (input.spotifyId && !/^[A-Za-z0-9]{22}$/.test(input.spotifyId)) ||
    (input.deezerId && !/^[1-9]\d*$/.test(input.deezerId))
  )
    return { status: "not_found" };
  try {
    const candidates = input.deezerId
      ? { status: "complete" as const, ids: [input.deezerId] }
      : await discoverDeezerCatalogCandidates(input.artistName);
    if (candidates.status === "incomplete_search") return candidates;
    const ids = candidates.ids;
    let headers: ReturnType<typeof getSpotifyHeaders> | undefined;
    const results = [];
    for (const deezerId of new Set(ids)) {
      const isrcs = await isrcsFromDeezer(deezerId, true);
      const matches = [];
      for (const isrc of isrcs) {
        matches.push(
          await readSpotifyRecordingMatch(
            isrc,
            AbortSignal.timeout(4000),
            await (headers ??= getSpotifyHeaders()),
          ),
        );
      }
      results.push({ ...chooseVerifiedSpotifyMatch(input.artistName, matches), deezerId });
    }
    const verified = results.filter(
      r => r.status === "verified" && (!input.spotifyId || r.spotifyId === input.spotifyId),
    );
    if (verified.length > 1 || results.some(r => r.status === "ambiguous"))
      return { status: "ambiguous" };
    const match = verified[0];
    if (match?.status === "verified") return { ...match, status: "verified" };
    return { status: "not_found" };
  } catch (error) {
    if (error instanceof SpotifyDeferredError)
      return {
        status: "provider_failure",
        retryAtMs: error.retryAtMs,
        failureConsumed: error.requested,
      };
    return { status: "provider_failure" };
  }
}
