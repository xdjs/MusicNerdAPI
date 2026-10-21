/** Spotify's artist object as `/api/getSpotifyData` passes it through, with
 *  the fields MusicNerdWeb defaulted always present. */
export type SpotifyArtistData = Record<string, unknown> & {
  id: string;
  name: string;
  images: unknown[];
  genres: unknown[];
  followers: unknown;
};

/** MusicNerdWeb's `getSpotifyArtist` answer: the artist, or why not. */
export type SpotifyArtistApiResponse = {
  error: string | null;
  data: SpotifyArtistData | null;
};
