import { wordsOf } from "@/lib/credits/wordsOf";

/**
 * Whether a bare name is written in a caption as whole words, in order. Folded
 * containment accepted the subject "Art" because the caption said "started",
 * which let a model invent a collaborator on a coincidence of letters.
 *
 * @param name - The name.
 * @param caption - The caption.
 * @returns True when the name's words appear consecutively in the caption.
 */
export function nameAppearsInCaption(name: string, caption: string): boolean {
  const nameWords = wordsOf(name);
  const captionWords = wordsOf(caption);
  return (
    nameWords.length > 0 &&
    captionWords.some((_, i) => nameWords.every((w, k) => captionWords[i + k] === w))
  );
}
