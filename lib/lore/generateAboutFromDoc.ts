import { streamText, type StreamTextOptions } from "@/lib/ai/streamText";
import { withTimeout } from "@/lib/async/withTimeout";
import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { aboutSystemInstruction } from "@/lib/lore/aboutSystemInstruction";
import { GEMINI_ABOUT_TIMEOUT_MS } from "@/lib/lore/const";
import type { DocSource } from "@/lib/lore/types";
import { validateCitations } from "@/lib/lore/validateCitations";

/**
 * Writes the public About from the cited Lore document. Streamed, so the
 * onboarding build can show it as it's written. A marker that doesn't resolve
 * to one of `sources` is stripped.
 *
 * @param artistName - The artist's name.
 * @param docContent - The Lore document.
 * @param sources - The document's numbered sources.
 * @param opts - Streaming options.
 * @param opts.onTextDelta - Called with each piece of text as it's written.
 * @returns The About, with valid markers kept, capped at MAX_BIO_LENGTH. Throws on an empty reply or a timeout.
 */
export async function generateAboutFromDoc(
  artistName: string,
  docContent: string,
  sources: DocSource[] = [],
  { onTextDelta }: Pick<StreamTextOptions, "onTextDelta"> = {},
): Promise<string> {
  const response = await withTimeout(
    streamText({
      onTextDelta,
      prompt: `ARTIST KNOWLEDGE DOCUMENT:\n${docContent}`,
      instructions: aboutSystemInstruction(artistName),
      temperature: 0.5,
      thinkingBudget: 0,
    }),
    GEMINI_ABOUT_TIMEOUT_MS,
    "Gemini timeout",
  );
  const raw = response.text?.trim();
  if (!raw) throw new Error("About generation returned empty text");
  return validateCitations(raw, sources).slice(0, MAX_BIO_LENGTH);
}
