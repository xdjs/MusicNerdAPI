/** When the post a claim came from was published, when stored. An undated quote cannot answer "lately". */
export type Dated = { postedAt?: string | null };

/** One person credited with a role, in the artist's own words. */
export interface CaptionCredit extends Dated {
  /** An Instagram handle without the @, or a name as written when no handle was used. */
  subject: string;
  /** True when `subject` is a handle we could link to, false when it is a bare name. */
  isHandle: boolean;
  /** The role as the artist wrote it: "Mixing & Mastering Engineer", "first bassist". */
  role: string;
  /** The sentence the credit was read from, verified to appear in the caption. */
  quote: string;
  /** The post this came from. */
  url: string;
  /** True when the artist is crediting themselves. Keep the fact, never draw the edge. */
  isSelf: boolean;
}

/**
 * Something the artist said about themselves. Deliberately not scoped to music:
 * a mother teaching them to make empanadas is what makes them a person rather
 * than a discography.
 */
export interface ArtistStatement extends Dated {
  /** Their words, verified to appear in the caption. */
  quote: string;
  /** A few words naming what it is about. */
  topic: string;
  url: string;
}

export interface CaptionExtraction {
  credits: CaptionCredit[];
  statements: ArtistStatement[];
}

/** A credit as the model returned it. Every field is untrusted until `verifyClaims` checks it. */
export interface RawCredit {
  subject?: unknown;
  isHandle?: unknown;
  role?: unknown;
  quote?: unknown;
  url?: unknown;
}

/** A statement as the model returned it. Untrusted until verified. */
export interface RawStatement {
  quote?: unknown;
  topic?: unknown;
  url?: unknown;
}

/** What one slice of caption reading got through. */
export interface ExtractionSlice {
  extraction: CaptionExtraction;
  /** A batch could not be read at all (a 429, a network error). Not progress. */
  failed?: boolean;
  /** Batch index to resume from. Equal to totalBatches when finished. */
  nextBatch: number;
  totalBatches: number;
  done: boolean;
}

/**
 * A collaborator as the artist described them: someone credited with a role in
 * their own captions. Stronger evidence than an Instagram coauthor tag.
 */
export interface CreditedCollaborator {
  subject: string;
  isHandle: boolean;
  /** Every distinct role the artist has given them, in their words. */
  roles: string[];
  /**
   * The roles given on more than one post: what the working relationship is,
   * as opposed to what happened once.
   */
  recurringRoles: string[];
  /** The artist's actual sentences, one per credit. */
  quotes: string[];
  evidenceUrls: string[];
}
