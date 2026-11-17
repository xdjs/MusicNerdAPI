import { EMBED_INPUT_CHARS } from "@/lib/units/types";

/**
 * Cuts a text to the most the embedding model is sent for one input.
 *
 * @param text - The unit text or query.
 * @returns The text, or its first `EMBED_INPUT_CHARS` characters cut at the last whitespace when there is one in the final 200 of them.
 */
export function truncateForEmbedding(text: string): string {
  if (text.length <= EMBED_INPUT_CHARS) return text;
  const cut = text.slice(0, EMBED_INPUT_CHARS);
  const space = cut.search(/\s\S*$/);
  return space >= EMBED_INPUT_CHARS - 200 ? cut.slice(0, space) : cut;
}
