/** Max characters in an artist bio. */
export const MAX_BIO_LENGTH = 10_000;

/** The About's target length. The automatic generator and onboarding write to the
 *  same `artists.bio`, so they share one length rule. */
export const ABOUT_TARGET_WORDS = 100;

export const ABOUT_LENGTH_RULE = `Write ONE paragraph, up to ~${ABOUT_TARGET_WORDS} words. Shorter is better than padded: if verified facts are thin, write two or three honest sentences.`;

/** Without it the model opens mid-catalogue and never says who the artist is. */
export const ABOUT_OPENING_RULE =
  'Establish who they are in the first sentence — name, what they make, where they are from. Do not bury it. "[Name] is a [role] from [place]" is a correct shape, not a required one: if the material gives you a better way in that still answers who this is, take it.';

/** Anti-padding companion to ABOUT_LENGTH_RULE. */
export const ABOUT_STOP_RULE = 'Stop when the facts run out. No closing "significance" flourish.';

/** The claim nudge shown (and cached into `artists.bio`) when there's nothing verified to write
 *  an About from. Never treated as a real bio. */
export const ABOUT_EMPTY_STATE =
  "We don't have enough verified information about this artist yet. If this is you, claim your profile and add a few sources to generate your About — or write your own. What you add helps Music Nerd tell your story to fans.";
