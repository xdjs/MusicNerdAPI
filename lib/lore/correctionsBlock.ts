import type { DocCorrection } from "@/lib/lore/types";

/**
 * The artist's corrections, which override every source. A "wrong" claim (or
 * a fix with no text) reads as a removal, never as a fact to keep.
 *
 * @param corrections - The artist's corrections.
 * @returns The prompt block, or null with none.
 */
export function correctionsBlock(corrections: DocCorrection[]): string | null {
  if (corrections.length === 0) return null;
  const lines = corrections.map(c =>
    c.kind === "fix" && c.correction
      ? `- WRONG: "${c.claim}"\n  THE ARTIST SAYS: ${c.correction}`
      : `- REMOVE, the artist says this is not true or not them: "${c.claim}"`,
  );
  return (
    `\n--- CORRECTIONS FROM THE ARTIST (these OVERRIDE the sources above) ---\n` +
    `${lines.join("\n")}\n--- END CORRECTIONS ---`
  );
}
