/** Staging's urlmap patterns (2026-09-29), as the database stores them. */
export const urlmapRows = [
  {
    siteName: "bandcamp",
    cardPlatformName: "Bandcamp",
    appStringFormat: "https://%@.bandcamp.com",
    regex: "^https:\\/\\/([^/]+)\\.bandcamp\\.[^/]+(?:\\/.*)?$",
  },
  {
    siteName: "deezer",
    cardPlatformName: "Deezer",
    appStringFormat: "deezer",
    regex: "deezer\\.com/(?:\\w+/)?artist/(\\d+)",
  },
  {
    siteName: "discogs",
    cardPlatformName: "Discogs",
    appStringFormat: "https://www.discogs.com/artist/%@",
    regex: "^https:\\/\\/(?:www\\.)?discogs\\.com\\/(?:artist|label)\\/(\\d+)(?:-[\\w-]+)?\\/?$",
  },
  {
    siteName: "facebook",
    cardPlatformName: "Facebook",
    appStringFormat: "https://www.facebook.com/%@",
    regex:
      "^https://(?:[^/]*\\.)?facebook\\.com/(?:people/[^/]+/([0-9]+)/?|profile\\.php\\?id=([0-9]+)(?:&[^#]*)?|([^/\\?#]+)/?)(?:[\\?#].*)?$",
  },
  {
    siteName: "instagram",
    cardPlatformName: "Instagram",
    appStringFormat: "https://instagram.com/%@",
    regex: "^https:\\/\\/[^/]*instagram\\.[^/]+\\/([^/]+)(?:\\/.*)?$",
  },
  {
    siteName: "soundcloud",
    cardPlatformName: "Soundcloud",
    appStringFormat: "https://www.soundcloud.com/%@",
    regex: "^https:\\/\\/(www\\.)?soundcloud\\.com\\/([^/]+)(?:\\/.*)?$",
  },
  {
    siteName: "spotify",
    cardPlatformName: "Spotify",
    appStringFormat: "https://open.spotify.com/artist/%@",
    regex:
      "^https:\\/\\/open\\.spotify\\.com\\/(track|album|artist|playlist|episode|show)\\/([a-zA-Z0-9]+)(?:\\?.*)?$",
  },
  {
    siteName: "wikipedia",
    cardPlatformName: "Wikipedia",
    appStringFormat: "https://wikipedia.org/wiki/%@",
    regex: "^https:\\/\\/[^/]*wikipedia\\.[^/]+\\/wiki\\/([^/]+)(?:\\/.*)?$",
  },
  {
    siteName: "x",
    cardPlatformName: "X",
    appStringFormat: "https://x.com/%@",
    regex: "https:\\/\\/[^/]*x\\.[^/]+\\/([^/]+)(?:\\/.*)?$",
  },
  {
    siteName: "youtube",
    cardPlatformName: "YouTube",
    appStringFormat: "https://youtube.com/@%@",
    regex: "^https://(www\\.)?youtube\\.com/(?:@([^/]+)|([^/]+))$",
  },
  {
    siteName: "youtubechannel",
    cardPlatformName: "YouTube",
    appStringFormat: "https://www.youtube.com/channel/%@",
    regex: "^https://(www\\.)?youtube\\.com/channel/([^/]+)$",
  },
].map((r, i) => ({ id: String(i), ...r }));
