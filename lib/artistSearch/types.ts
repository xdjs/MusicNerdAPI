/** One row of the name search, the columns MusicNerdWeb's query selected. */
export type ArtistSearchRow = {
  id: string;
  name: string | null;
  spotify: string | null;
  deezer: string | null;
  bandcamp: string | null;
  youtube: string | null;
  youtubechannel: string | null;
  instagram: string | null;
  x: string | null;
  facebook: string | null;
  tiktok: string | null;
  customImage: string | null;
  match_type: number;
};

/** A Music Nerd artist in `POST /api/searchArtists` results. */
export type LocalSearchArtistResult = ArtistSearchRow & {
  bio: null;
  isExternalOnly: false;
  imageUrl: string | null;
  matchScore: number;
  linkCount: number;
};

/** A Deezer artist not yet in Music Nerd. */
export type ExternalSearchArtistResult = {
  id: null;
  name: string;
  platformId: string;
  platform: string;
  imageUrl: string | null;
  profileUrl: string;
  isExternalOnly: true;
  matchScore: number;
  linkCount: number;
};

export type SearchArtistResult = LocalSearchArtistResult | ExternalSearchArtistResult;
