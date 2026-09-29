import { generateText } from "@/lib/ai/generateText";
import { withTimeout } from "@/lib/async/withTimeout";
import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { buildDocContext } from "@/lib/lore/buildDocContext";
import { FALLBACK_TIMEOUT_MS } from "@/lib/lore/const";
import { fallbackAboutInstruction } from "@/lib/lore/fallbackAboutInstruction";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";
import type { DocSource } from "@/lib/lore/types";

/**
 * The last-resort About, when the cited pipeline failed twice. A degraded
 * About beats none. Writes from the finished document when there is one;
 * otherwise re-reads the same material the document would have used.
 *
 * @param artistId - The artist.
 * @param artistName - The artist's name.
 * @param docContent - The Lore document, when it was written.
 * @param presetSources - The numbered sources to rebuild the material against.
 * @returns A plain-text About with every marker stripped, capped at MAX_BIO_LENGTH. Throws on an empty reply or a timeout.
 */
export async function synthesizeFallbackAbout(
  artistId: string,
  artistName: string,
  docContent?: string,
  presetSources?: DocSource[],
): Promise<string> {
  const materialText = docContent ?? (await buildDocContext(artistId, presetSources)).context;
  const response = await withTimeout(
    generateText({
      prompt: `ARTIST MATERIAL:\n${materialText}`,
      instructions: fallbackAboutInstruction(artistName),
      temperature: 0.5,
      thinkingBudget: 0,
    }),
    FALLBACK_TIMEOUT_MS,
    "Gemini timeout",
  );
  const raw = response.text?.trim();
  if (!raw) throw new Error("Fallback About generation returned empty text");
  // The material may be a cited document the model echoes; this path has no manifest to check against.
  return stripCitationMarkers(raw).slice(0, MAX_BIO_LENGTH);
}
