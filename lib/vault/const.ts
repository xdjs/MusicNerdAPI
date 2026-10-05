/**
 * Per-URL read budget for page verification. Fetches run in parallel, so this
 * is the pass's cost; 5 s demoted real sites (peterango.com reads in ~6 s).
 */
export const VERIFY_TIMEOUT_MS = 8000;

/** Index-page links followed per run. */
export const MAX_INDEX_FOLLOWS = 3;

/** Outbound links resolved when deciding whether a page is the artist's own; matches OUTBOUND_LINK_CAP. */
export const MAX_CORROBORATION_CHECKS = 25;

/** Account pages verified per run; each is one link-preview fetch. */
export const MAX_ACCOUNT_CHECKS = 10;

/** Hub pages examined for ownership per run. */
export const MAX_HUB_PAGES = 5;

/** Ceiling on the propagation pass. */
export const PROPAGATION_BUDGET_MS = 10_000;

/**
 * How much of a handle must look like the artist's name before a page merely
 * mentioning them counts as theirs: "dupesdidit" against "Sherwinn Dupes Brice"
 * fails on prefix, "insomniac" against "hardwell" can't pass.
 */
export const HANDLE_STEM_MIN = 4;

/**
 * Reference databases: a record of work, not an account. Adopted when found,
 * never probed for, since a Discogs id can't be guessed from a handle.
 */
export const REFERENCE_PLATFORMS = new Set(["discogs"]);

/**
 * Platforms whose id is an account the artist owns, so "this page is about the
 * artist" also means "this account is theirs". Not wikipedia or imdb: those are
 * articles about a subject.
 */
export const ACCOUNT_PLATFORMS = new Set([
  "instagram",
  "x",
  "tiktok",
  "youtube",
  "youtubechannel",
  "soundcloud",
  "bandcamp",
  "twitch",
  "facebook",
  "spotify",
  "deezer",
]);

/** Opaque account IDs must not be folded like user-chosen handles. */
export const CASE_SENSITIVE_ACCOUNT_IDS = new Set(["spotify", "youtubechannel"]);

/**
 * Platforms a probe can't settle: tiktok serves a bot nothing, twitch only
 * echoes the handle, bandcamp answers for subdomains nobody owns. A URL from
 * search is still adopted; only guessing is blocked.
 */
export const PROBE_BLIND_PLATFORMS = new Set(["tiktok", "twitch", "bandcamp"]);

/** Stored handles shorter than this match far too much. */
export const IDENTITY_MATCH_MIN_LENGTH = 4;

/**
 * Public suffixes that take two labels. Not exhaustive: a missing one makes the
 * own-domain check stricter, never looser.
 */
export const TWO_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "me.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.za",
  "com.br",
  "co.jp",
  "or.jp",
  "co.kr",
  "com.mx",
]);

/** Suffixes a musician actually appends to their name in a domain. Each entry widens what counts as theirs. */
export const OWN_DOMAIN_SUFFIXES = [
  "",
  "music",
  "official",
  "band",
  "sound",
  "sounds",
  "hq",
  "live",
  "tv",
];

/** Results asked of each search query: five queries, deduped heavily in practice. */
export const TAVILY_RESULTS_PER_QUERY = 5;
