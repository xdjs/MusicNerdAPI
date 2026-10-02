/**
 * An ASCII-compatible slug for question keys. Stored keys are shared with
 * MusicNerdWeb under a unique (artist, question_key) index, so this must stay
 * byte-identical to its `slug`: "_" stays in the class, so ASCII input keys the
 * same as before, while letters of any script no longer collapse to "x".
 *
 * @param s - A handle, topic, title or url.
 * @returns At most 40 characters; "x" when nothing is left.
 */
export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}_]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "x"
  );
}
