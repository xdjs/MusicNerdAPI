/** A mutual, Instagram-accepted collaboration: a coauthor tag, or somebody else's post on the artist's feed. */
export interface Collaborator {
  handle: string;
  postCount: number;
  evidenceUrls: string[];
}

/** A track credit on a post that is plausibly the artist's own work. */
export interface MusicReference {
  title: string;
  artist: string;
  evidenceUrls: string[];
  /** True if at least one referencing post is the artist's own. */
  postedByOwn: boolean;
  /** Owner of the first post that carried this credit. */
  ownerUsername: string;
}

/** A recurring hashtag, caption word or two-word phrase from the artist's own posts. */
export interface Theme {
  term: string;
  kind: "hashtag" | "caption_term" | "caption_phrase";
  count: number;
  evidenceUrls: string[];
}

/** Running counts while themes are derived, keyed `${kind}:${term}`. */
export type ThemeTally = Map<
  string,
  { kind: Theme["kind"]; count: number; evidenceUrls: string[] }
>;

/** An own post whose engagement is a large multiple of the artist's own median. */
export interface StandoutPost {
  url: string;
  metric: "likes" | "plays";
  value: number;
  median: number;
  multiple: number;
  caption: string | null;
}

/** What the interview questions are built from. MusicNerdWeb also derives
 *  mentioned accounts; nothing here reads them, so they aren't derived. */
export interface SocialSignals {
  collaborators: Collaborator[];
  themes: Theme[];
  standoutPosts: StandoutPost[];
  musicReferences: MusicReference[];
}
