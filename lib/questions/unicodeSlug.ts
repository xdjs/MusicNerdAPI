/**
 * A slug that keeps letters and digits of any script, so a name outside ASCII
 * still identifies one person. Used for person-keyed questions (credit,
 * partnership); must match MusicNerdWeb byte for byte.
 *
 * @param s - A person's name or handle.
 * @returns At most 60 characters; "x" when nothing is left.
 */
export function unicodeSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "x"
  );
}
