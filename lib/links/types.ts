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

/** The profile's two link sections. */
export type LinkSection = "links" | "support";

/** One link as the profile shows it. */
export interface ProfileLink {
  siteName: string;
  href: string;
  label: string;
  iconSrc: string;
}

/** A profile link backed by an approved vault source. */
export type SourceLink = ProfileLink & {
  sourceId: string;
  kind: "artist" | "release" | "website";
};

/** The source fields that decide whether a source is shown as a destination. */
export type DestinationSource = {
  url: string;
  type?: string | null;
  status?: string;
  podcastEpisodeKey?: string | null;
};
