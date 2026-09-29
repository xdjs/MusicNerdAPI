/**
 * How much a source is worth, so the good ones come first. Ported from
 * MusicNerdWeb's `src/lib/source/sourceAuthority.ts`. Higher is better; only
 * the order matters. Ranking never filters: a low rank means "further down".
 */
export const AUTHORITY = {
  /** A publication wrote about them: interviews, features, reviews. */
  EDITORIAL: 100,
  /** A credits database: a record of work done, often on somebody else's release. */
  CREDITS: 90,
  /** Their own site. */
  OWN_SITE: 80,
  /** Their own words, from their own feed. */
  OWN_WORDS: 70,
  /** A streaming or store page. */
  CATALOGUE: 50,
  /** A directory that scraped a handle. */
  AGGREGATOR: 20,
  /** Anything we could not place, kept above aggregators so a local zine is not buried under a scraper. */
  UNKNOWN: 40,
} as const;

/** Hosts that publish credits rather than prose. */
export const CREDITS_HOSTS = [
  "discogs.com",
  "musicbrainz.org",
  "allmusic.com",
  "secondhandsongs.com",
  "whosampled.com",
  "genius.com",
  "45worlds.com",
  "rateyourmusic.com",
];

/** Hosts with no author: every page is generated from a scrape or a catalogue feed. Ranked as aggregators here. */
export const BLOCKED_HOSTS = [
  "boomplay.com",
  "viberate.com",
  "soundcharts.com",
  "clubhousedb.com",
  "socialblade.com",
  "kworb.net",
  "chartmasters.org",
  "starngage.com",
  "hypeauditor.com",
  "influencermarketinghub.com",
  "viewstats.com",
];

/** Hosts that re-list other platforms' data but are not blocked. */
export const AGGREGATOR_HOSTS = ["musicbrainz-mirror.org", "last.fm/user"];

/** Streaming, stores and video: the artist's catalogue as anyone can see it. */
export const CATALOGUE_HOSTS = [
  "open.spotify.com",
  "music.apple.com",
  "deezer.com",
  "tidal.com",
  "music.amazon.com",
  "soundcloud.com",
  "bandcamp.com",
  "audiomack.com",
  "music.youtube.com",
  "beatport.com",
  "traxsource.com",
];

/** Readable page text below this is navigation, not an article we read. */
export const MIN_VERIFIED_TEXT = 400;

/** Pages that answer 200 while meaning 404: parked domains and soft-404 templates. */
export const DEAD_PAGE_MARKERS = [
  "no results found",
  "page not found",
  "page you requested could not be found",
  "this domain is registered",
  "domain is for sale",
  "buy this domain",
  "checking your browser",
  "enable javascript",
];

/** Every vault source type. */
export const SOURCE_TYPES = [
  "article",
  "interview",
  "review",
  "profile",
  "document",
  "image",
  "audio",
  "video",
  "data",
  "social",
  "website",
] as const;

/** A source's type from its domain (or a subdomain of it). */
export const DOMAIN_TYPE_MAP: Record<string, (typeof SOURCE_TYPES)[number]> = {
  "pitchfork.com": "review",
  "albumoftheyear.org": "review",
  "metacritic.com": "review",
  "rollingstone.com": "interview",
  "nme.com": "interview",
  "thefader.com": "interview",
  "youtube.com": "video",
  "youtu.be": "video",
  "vimeo.com": "video",
  "tiktok.com": "video",
  "twitter.com": "social",
  "x.com": "social",
  "instagram.com": "social",
  "facebook.com": "social",
  "threads.net": "social",
  "soundcloud.com": "audio",
  "bandcamp.com": "audio",
  "audiomack.com": "audio",
  "allmusic.com": "profile",
  "genius.com": "profile",
  "last.fm": "profile",
  "rateyourmusic.com": "profile",
  "discogs.com": "profile",
  "wikipedia.org": "profile",
};

/** A source's type from a path segment, when its domain says nothing. */
export const PATH_KEYWORD_MAP: Record<string, (typeof SOURCE_TYPES)[number]> = {
  interview: "interview",
  interviews: "interview",
  review: "review",
  reviews: "review",
  profile: "profile",
  profiles: "profile",
  video: "video",
  videos: "video",
};

/** Type names a model or provider uses for one of ours. */
export const TYPE_ALIASES: Record<string, (typeof SOURCE_TYPES)[number]> = { news: "article" };

/** Hosts automatic Lore discovery never files. Sources the artist submits keep their own policy. */
export const LORE_EXCLUDED_DISCOVERY_HOSTS = ["linkedin.com", "lnkd.in"];
