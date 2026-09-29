import type { LinkPreview } from "@/lib/pages/types";

/** Default read budget. Callers on a latency path pass something tighter. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * How much body text is kept for storage. Generous enough for a long-form
 * interview whole; still bounded so a pathological page doesn't put megabytes
 * in a row. `selectSourceText` decides what reaches a prompt.
 */
export const EXTRACT_MAX_CHARS = 50_000;

/** The user agent every page read sends. It clears Spotify's and Instagram's bot checks; a browser UA gets blocked. */
export const BOT_USER_AGENT = "MusicNerdBot/1.0";

/** Elements that never carry a page's subject, removed with their contents. <header> is absent on purpose: headlines live there. */
export const CHROME_TAGS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "nav",
  "footer",
  "aside",
  "form",
  "select",
  "button",
  "dialog",
];

/** Block closers that end a paragraph. Inline elements stay a space so a sentence isn't cut mid-clause. */
export const BLOCK_BREAK =
  /<\/(p|div|section|article|li|ul|ol|tr|h[1-6]|blockquote|figcaption|dd|dt|pre|table)\s*>|<br\s*\/?>|<hr\s*\/?>/gi;

/** Meta names carrying a publication date, best evidence first. */
export const DATE_META_KEYS = [
  "article:published_time",
  "article:modified_time",
  "datepublished",
  "date",
  "dc.date.issued",
  "og:updated_time",
  "pubdate",
];

/** Path segments that mark a listing rather than an article. */
export const NON_ARTICLE_PATH =
  /\/(tags?|categor(y|ies)|author|page|search|feed|wp-|wp-content|wp-admin|comments?|login|register|subscribe|privacy|terms|contact|about-us)(\/|$|\?)/i;

/** Most off-host links kept from one page. */
export const OUTBOUND_LINK_CAP = 25;

/** Most same-host article links kept from one index page. */
export const ARTICLE_LINK_CAP = 25;

/** Per-fetch timeout for a link preview. A Spotify URL can chain two fetches (oEmbed, then the scrape). */
export const PREVIEW_TIMEOUT_MS = 4_000;

/** Spotify's official oEmbed endpoint: no scraping, no auth. */
export const SPOTIFY_OEMBED_ENDPOINT = "https://open.spotify.com/oembed?url=";

/** What a link preview resolves to on any failure. */
export const EMPTY_PREVIEW: LinkPreview = { imageUrl: null, title: null };
