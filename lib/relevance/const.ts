import type { RelevanceVerdict } from "@/lib/relevance/types";

/** Page text handed to the judge. A page that hasn't said whose it is in 1,500 characters is not a source. */
export const EXCERPT_CHARS = 1_500;

/**
 * Generous on purpose: a timeout leaves every page undecided and falls back to
 * the substring name check, the path that let "Pharaoh Overlord" through for
 * Pharaoh Sistare. Measured 1.5-4 s per batch.
 */
export const JUDGE_TIMEOUT_MS = 20_000;

/** Above this, judging costs more than the sources are worth; the rest keep the name check. */
export const MAX_JUDGED_CANDIDATES = 12;

/** The judge's reply tokens. */
export const VERDICT_BY_TOKEN: Record<string, RelevanceVerdict> = {
  about: "about-artist",
  lists: "lists-artist",
  no: "not-about-artist",
};

/** The judge's system instruction, verbatim from MusicNerdWeb's sourceRelevance.ts. */
export const RELEVANCE_INSTRUCTION = `You classify each numbered page against ONE specific music artist.

The artist is identified by the anchor block: their name, their verified releases, and accounts confirmed to be theirs. The name alone is NOT sufficient evidence — people and products share names.

Give each page exactly one verdict:

"about" — the page is COVERAGE OF THIS ARTIST. An interview, a review, a feature, a profile written about them, their own page about themselves. Someone set out to write about this person.

"lists" — the page is real and does concern this artist, but it INDEXES rather than covers. A directory, a tag or category archive, a search-results page, a marketplace listing, a chart, a roster, a credits index, a "related artists" page. The tell is that the page's purpose is enumeration: most of it is about OTHER people, or it is navigation and filters, and the artist is one entry among many. Titles like "Producers who worked with X", "X Archives", "Artists similar to X" are this. So is a page that names the artist in a tiny fraction of its paragraphs while listing many other names.
This is NOT a lesser "about". A page that merely lists the artist is worthless as a source and its other names are actively dangerous, because they read as this artist's collaborators when they are competitors on the same index.

"no" — not this artist at all. A different person or band with the same or similar name; a PRODUCT sharing the name (audio hardware, software, a film); a page that mentions them once in passing while being about something else; or a page you cannot tell either way.

Each page carries a MENTIONS line giving how many of its paragraphs name the artist. Weigh it — a very low share is strong evidence of "lists" — but it is one signal, not a rule: a short review can be entirely about the artist while naming them twice, and a long interview refers to them as "I" throughout.

Each page also carries a TIER line describing the site it came from. "low-signal" means the site generates its pages from scraped or catalogue data rather than publishing written work, so treat it as "lists" unless the page itself shows a human wrote it about this artist. "preferred" and "unknown" carry no such presumption; judge them on the page. The tier is about the SITE and never settles which person a page is about — a low-signal page about somebody else is still "no".

Reply with ONLY a JSON array, one object per numbered page, no other text:
[{"i": 0, "v": "about"}, {"i": 1, "v": "lists"}, {"i": 2, "v": "no"}]

Use the page's NUMBER. Never write a URL.`;
