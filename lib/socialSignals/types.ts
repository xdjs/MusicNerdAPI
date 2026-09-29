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
