import type { PROFILE_DISPLAY_COLUMNS } from "@/lib/links/const";

/** One of the profile-card columns. */
export type ProfileDisplayColumn = (typeof PROFILE_DISPLAY_COLUMNS)[number];

/** The urlmap fields a profile card is drawn from. */
export interface UrlmapPresentationRow {
  cardPlatformName?: string | null;
  siteImage?: string | null;
  colorHex?: string | null;
  appStringFormat?: string | null;
}

/** How one {siteName, value} pair is shown. */
export interface LinkPresentationMeta {
  displayName: string;
  logoUrl: string | null;
  colorHex: string | null;
  profileUrl: string | null;
}
