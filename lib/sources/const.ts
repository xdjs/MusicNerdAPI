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
