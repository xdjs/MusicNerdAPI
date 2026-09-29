import type { artists, urlmap } from "@/lib/db/schema";

/** A full artist row. */
export type ArtistRow = typeof artists.$inferSelect;

/** One urlmap row. */
export type UrlMapRow = typeof urlmap.$inferSelect;

/** A URL resolved to a platform and the artist's id on it. */
export type ExtractedArtistId = { siteName: string; cardPlatformName: string | null; id: string };
