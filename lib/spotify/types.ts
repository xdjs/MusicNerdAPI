/** Spotify bearer headers, in the shape `fetch` takes them. */
export type SpotifyHeaders = { headers: { Authorization: string } };

/** One release from the artist's Spotify catalog. */
export interface SpotifyRelease {
  name: string;
  releaseDate: string | null;
  /** album, single or appears_on. */
  kind: string | null;
  url: string | null;
}
