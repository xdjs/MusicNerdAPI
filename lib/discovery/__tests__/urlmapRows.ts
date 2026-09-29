/** urlmap presentation rows for discovery tests, from MusicNerdWeb's fixture. */
export const URLMAP_ROWS = [
  {
    siteName: "spotify",
    cardPlatformName: "Spotify",
    siteImage: "https://cdn/spotify.png",
    colorHex: "#1DB954",
    appStringFormat: "https://open.spotify.com/artist/%@",
  },
  {
    siteName: "deezer",
    cardPlatformName: "Deezer",
    siteImage: "https://cdn/deezer.png",
    colorHex: "#FEAA2D",
    appStringFormat: "https://www.deezer.com/artist/%@",
  },
  {
    siteName: "instagram",
    cardPlatformName: "Instagram",
    siteImage: "https://cdn/instagram.png",
    colorHex: "#E1306C",
    appStringFormat: "https://instagram.com/%@",
  },
  {
    siteName: "tiktok",
    cardPlatformName: "TikTok",
    siteImage: null,
    colorHex: "#000000",
    appStringFormat: "https://tiktok.com/@%@",
  },
  {
    siteName: "x",
    cardPlatformName: "X",
    siteImage: null,
    colorHex: null,
    appStringFormat: "https://x.com/%@",
  },
  {
    siteName: "youtube",
    cardPlatformName: "YouTube",
    siteImage: null,
    colorHex: "#FF0000",
    appStringFormat: "https://youtube.com/@%@",
  },
  {
    siteName: "facebook",
    cardPlatformName: "Facebook",
    siteImage: null,
    colorHex: "#1877F2",
    appStringFormat: "https://facebook.com/%@",
  },
];

/** The same rows, keyed by column. */
export const URLMAP_BY_SITE = new Map(URLMAP_ROWS.map(r => [r.siteName, r]));
