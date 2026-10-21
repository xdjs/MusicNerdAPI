/** Link columns shown as onboarding profile cards: the curated subset of the
 *  writable link columns that discovery targets. Every candidate must land on
 *  one of these to ever be writable. */
export const PROFILE_DISPLAY_COLUMNS = [
  "spotify",
  "deezer",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "soundcloud",
  "bandcamp",
  "twitch",
  "facebook",
] as const;

/** Platforms shown under Support whatever the urlmap says. */
export const SUPPORT_SITES = new Set(["bandcamp", "inprocess", "supercollector", "subvert"]);

/** Icons the website serves itself, preferred over the urlmap's. */
export const LOCAL_LINK_ICONS: Record<string, string> = {
  bandcamp: "/siteIcons/bandcamp_icon.svg",
  soundcloud: "/siteIcons/soundcloud_icon.svg",
  audius: "/siteIcons/audius_icon.svg",
  youtube: "/siteIcons/youtube_icon.svg",
  youtubechannel: "/siteIcons/youtube_icon.svg",
  subvert: "/siteIcons/subvert_icon.jpg",
  inprocess: "/siteIcons/inprocess_icon.svg",
};

/** Icons for source-backed catalog links, by music platform. */
export const MUSIC_ICONS: Record<string, string> = {
  apple_music: "/siteIcons/applemusic_icon.svg",
  beatport: "/siteIcons/beatport_icon.svg",
  spotify: "/siteIcons/spotify_icon.svg",
  deezer: "/siteIcons/deezer_icon.svg",
  bandcamp: "/siteIcons/bandcamp_icon.svg",
  soundcloud: "/siteIcons/soundcloud_icon.svg",
  audius: "/siteIcons/audius_icon.svg",
  subvert: "/siteIcons/subvert_icon.jpg",
};
