export type GroundedQuestionKind =
  | "collaborator"
  | "theme"
  | "standout"
  | "music"
  | "credit"
  | "statement"
  /** A relationship computed from the posts: the same person credited across
   *  several of them, or two things said in one. */
  | "partnership"
  | "same_post"
  | "recent"
  | "lore";

export interface GroundedQuestion {
  key: string;
  question: string;
  rationale: string;
  sourceUrls: string[];
  kind: GroundedQuestionKind;
}

/** One candidate handed to the model. `key`, `sourceUrls` and `kind` are read
 *  off this object after the model picks a `signalId`, never from its reply,
 *  which is what makes fabricating them structurally impossible. */
export interface SignalCandidate {
  signalId: string;
  kind: GroundedQuestionKind;
  key: string;
  /** "artist", or "@handle" when the material is somebody else's post. */
  authoredBy: string;
  material: string;
  sourceUrls: string[];
}

/** A drafted question, not yet checked. `materials` is the only thing it may assert. */
export interface DraftedQuestion extends GroundedQuestion {
  materials: string[];
  /** Why it reads like a template, if it does. Ranked below clean questions, not dropped. */
  demotedFor?: string;
}

/** A model answer resolved to one of our candidates. */
export interface EligibleDraft {
  candidate: SignalCandidate;
  question: string;
  rationale: string;
  boilerplate: string | null;
}
