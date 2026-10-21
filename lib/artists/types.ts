import type { artists, urlmap } from "@/lib/db/schema";

/** A full artist row. */
export type ArtistRow = typeof artists.$inferSelect;

/** One urlmap row. */
export type UrlMapRow = typeof urlmap.$inferSelect;

/** A URL resolved to a platform and the artist's id on it. */
export type ExtractedArtistId = { siteName: string; cardPlatformName: string | null; id: string };

/** What `searchForArtistByName` selects per artist. */
export type ArtistSearchRow = Pick<
  ArtistRow,
  | "id"
  | "name"
  | "spotify"
  | "deezer"
  | "bandcamp"
  | "youtube"
  | "youtubechannel"
  | "instagram"
  | "x"
  | "facebook"
  | "tiktok"
> & { customImage: string | null; match_type: number };

/** A urlmap row with the artist's URL on that platform. */
export type ArtistLink = UrlMapRow & { artistUrl: string };
