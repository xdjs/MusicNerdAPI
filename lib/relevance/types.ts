/** The judge's answer for one page. `undecided` means it wasn't judged; the caller falls back to the name check. */
export type RelevanceVerdict = "about-artist" | "lists-artist" | "not-about-artist" | "undecided";

/** One fetched page to judge. */
export type RelevanceCandidate = {
  url: string;
  title: string | null;
  text: string | null;
  /** The URL is the artist's own domain, which the caller knows and a hostname can't tell. Only affects the tier shown. */
  ownDomain?: boolean;
};

/** What we can prove about who the artist is, beyond their name. */
export type ArtistAnchor = {
  name: string;
  /** Real release and track names from their verified catalog. */
  catalog?: string[];
  /** Confirmed accounts, e.g. "instagram: p3t3rango". */
  identifiers?: string[];
};

/** One row of the judge's reply, before validation. */
export type RelevanceRow = { i?: unknown; v?: unknown };
