import { generateText } from "@/lib/ai/generateText";
import { streamText, type StreamTextOptions } from "@/lib/ai/streamText";
import { withTimeout } from "@/lib/async/withTimeout";
import { buildDocContext } from "@/lib/lore/buildDocContext";
import { ARTIST_DOC_MAX_CHARS, GEMINI_TIMEOUT_MS } from "@/lib/lore/const";
import { docSystemInstruction } from "@/lib/lore/docSystemInstruction";
import type { DocSource } from "@/lib/lore/types";
import { validateCitations } from "@/lib/lore/validateCitations";

/**
 * Writes the Lore document from the artist's current material. Ungrounded: the
 * numbered sources and their own words are the whole input. Thinking is off;
 * it cost 16-21 s on this call with no measured gain in citation accuracy.
 *
 * @param artistId - The artist.
 * @param presetSources - The numbered sources to cite, when the caller already built them.
 * @param opts - Streaming options.
 * @param opts.onTextDelta - Called with each piece of the document as it's written.
 * @returns The validated document and the numbered sources it cites, from the same read.
 */
export async function synthesizeArtistDoc(
  artistId: string,
  presetSources?: DocSource[],
  { onTextDelta }: Pick<StreamTextOptions, "onTextDelta"> = {},
): Promise<{ doc: string; sources: DocSource[] }> {
  const { artistName, context, sources } = await buildDocContext(artistId, presetSources);
  const today = new Date().toISOString().slice(0, 10);
  const call = {
    prompt: context,
    instructions: docSystemInstruction(artistName, today),
    temperature: 0.4,
    thinkingBudget: 0,
  };
  // Streamed only when the onboarding build shows it being written; the Lore
  // refresh keeps its non-streaming call.
  const response = await withTimeout(
    onTextDelta ? streamText({ ...call, onTextDelta }) : generateText(call),
    GEMINI_TIMEOUT_MS,
    "Gemini timeout",
  );
  const raw = response.text?.trim();
  if (!raw) throw new Error("Doc synthesis returned empty text");
  return { doc: validateCitations(raw, sources).slice(0, ARTIST_DOC_MAX_CHARS), sources };
}
