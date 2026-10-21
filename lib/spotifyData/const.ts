import type { SpotifyArtistData } from "@/lib/spotifyData/types";

/** Spotify's `/v1/artists?ids=` takes at most this many; the batch routes
 *  refuse more. */
export const SPOTIFY_BATCH_MAX = 50;
/** The POST batch gives up after this, before Vercel does. */
export const SPOTIFY_BATCH_TIMEOUT_MS = 12_000;
/** A successful single-artist answer is kept this long, as MusicNerdWeb kept it. */
export const SPOTIFY_ARTIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Successful single-artist answers by Spotify id, per instance. */
export const spotifyArtistCache = new Map<string, { at: number; data: SpotifyArtistData }>();
