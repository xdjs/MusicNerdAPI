/** Where a physical column name and its Drizzle row property disagree. */
export const ARTIST_ROW_PROPERTY_BY_COLUMN: Record<string, string> = {
  facebookID: "facebookId",
  tiktokID: "tiktokId",
};

/**
 * Platforms outside the original eleven that urlmap configures. Kept explicit
 * rather than derived from urlmap templates, which give the wrong host for
 * bandcamp and spotify.
 */
export const PLATFORM_DOMAINS_EXTRA: Record<string, string[]> = {
  audius: ["audius.co"],
  bandsintown: ["bandsintown.com"],
  bluesky: ["bsky.app"],
  catalog: ["catalog.works"],
  discogs: ["discogs.com"],
  facebookID: ["facebook.com", "fb.com"],
  farcaster: ["farcaster.xyz", "warpcast.com"],
  foundation: ["foundation.app"],
  imdb: ["imdb.com"],
  inprocess: ["inprocess.world"],
  lens: ["hey.xyz", "lens.xyz"],
  linktree: ["linktr.ee"],
  mirror: ["mirror.xyz"],
  patreon: ["patreon.com"],
  soundxyz: ["sound.xyz"],
  subvert: ["subvert.fm"],
  supercollector: ["supercollector.xyz"],
  wikipedia: ["wikipedia.org"],
  zora: ["zora.co"],
};

/** The artist's own platform links, used to recognise "a profile we already hold". */
export const PROFILE_LINK_COLUMNS = [
  "spotify",
  "deezer",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "youtubechannel",
  "soundcloud",
  "bandcamp",
  "twitch",
  "facebook",
  ...Object.keys(PLATFORM_DOMAINS_EXTRA),
] as const;

/**
 * The name-shaped identifiers worth handing the relevance judge. Opaque values
 * (discogs and facebookID numbers, imdb ids) and wallet names are left out:
 * any page containing the digits would read as being about the artist.
 */
export const IDENTITY_ANCHOR_COLUMNS = [
  "spotify",
  "deezer",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "youtubechannel",
  "soundcloud",
  "bandcamp",
  "twitch",
  "facebook",
  "wikipedia",
  "bandsintown",
  "linktree",
  "audius",
  "catalog",
  "patreon",
  "supercollector",
  "subvert",
  "soundxyz",
] as const;

/** Every platform we store an id for, and the hosts it lives on. */
export const PLATFORM_DOMAINS: Record<string, string[]> = {
  spotify: ["spotify.com"],
  deezer: ["deezer.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  x: ["x.com", "twitter.com"],
  youtube: ["youtube.com", "youtu.be"],
  youtubechannel: ["youtube.com"],
  soundcloud: ["soundcloud.com"],
  bandcamp: ["bandcamp.com"],
  twitch: ["twitch.tv"],
  facebook: ["facebook.com", "fb.com"],
  ...PLATFORM_DOMAINS_EXTRA,
};

/**
 * Path segments that urlmap patterns capture as a handle but never are:
 * `instagram.com/p/<id>` resolves to the "handle" p, and x.com/artists was once
 * adopted as an artist's X handle.
 */
export const RESERVED_HANDLES: Record<string, Set<string>> = {
  instagram: new Set(["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct"]),
  facebook: new Set([
    "photo",
    "photos",
    "groups",
    "events",
    "pages",
    "watch",
    "story.php",
    "permalink.php",
    "sharer",
  ]),
  x: new Set([
    "i",
    "status",
    "intent",
    "search",
    "hashtag",
    "home",
    "explore",
    "notifications",
    "artists",
    "settings",
    "messages",
    "compose",
    "share",
    "login",
    "signup",
    "about",
  ]),
  tiktok: new Set(["video", "tag", "search", "discover", "music", "effect"]),
  youtube: new Set([
    "watch",
    "shorts",
    "playlist",
    "results",
    "feed",
    "channel",
    "embed",
    "user",
    "c",
    "live",
    "gaming",
    "music",
    "movies",
    "premium",
    "about",
  ]),
  youtubechannel: new Set(["watch", "shorts", "playlist", "results", "feed", "embed"]),
  soundcloud: new Set(["search", "discover", "stream", "you", "tags", "charts"]),
  twitch: new Set(["videos", "directory", "settings", "downloads"]),
  spotify: new Set(["track", "album", "playlist", "search", "user", "episode", "show"]),
  deezer: new Set(["album", "track", "playlist", "search", "profile", "show"]),
};

/** urlmap changes rarely and is read on every URL resolution, so it is memoized this long. */
export const URLMAP_TTL_MS = 60_000;

/** Platforms whose urlmap rows discovery never resolves. */
export const UNRESOLVED_URLMAP_SITES = ["catalog", "foundation", "soundxyz", "sound"];
