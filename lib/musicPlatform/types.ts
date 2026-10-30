/** The music platforms an artist's data is read from. */
export type MusicPlatform = "spotify" | "deezer";

/** One artist on a music platform, normalized across Spotify and Deezer. */
export interface MusicPlatformArtist {
  platform: MusicPlatform;
  platformId: string;
  name: string;
  imageUrl: string | null;
  followerCount: number | null;
  albumCount: number;
  genres: string[];
  profileUrl: string;
  topTrackName: string | null;
}

/** A Spotify Web API artist, as far as it is read here. */
export interface SpotifyArtistPayload {
  id: string;
  name: string;
  images: { url: string }[];
  followers: { total: number };
  genres: string[];
  external_urls: { spotify: string };
}

/** A Deezer API artist, as far as it is read here. */
export interface DeezerArtistPayload {
  id: number;
  name: string;
  link: string;
  picture_medium: string;
  picture_xl: string;
  nb_fan: number;
  nb_album: number;
}

export type CatalogCounterpartResult =
  | { status: "verified"; spotifyId: string; deezerId: string; recordings: number }
  | { status: "not_found" | "ambiguous" | "incomplete_search" }
  | { status: "provider_failure"; retryAtMs?: number; failureConsumed?: boolean };
