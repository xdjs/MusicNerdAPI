import { SOURCE_TEXT_BUDGET } from "@/lib/lore/const";
import { mentionsArtist } from "@/lib/lore/mentionsArtist";

/**
 * The most relevant `SOURCE_TEXT_BUDGET` characters of a source, not the first.
 * A head slice favours whatever a page opens with, which for an interview is
 * childhood; a real artist's HBO placement sat past the cut. Paragraphs naming
 * the artist are kept first, then the rest fill the budget, in original order.
 *
 * @param text - The source's extracted text.
 * @param artistName - The artist's name.
 * @returns The selected text.
 */
export function selectSourceText(text: string, artistName: string): string {
  if (text.length <= SOURCE_TEXT_BUDGET) return text;

  const paragraphs = text.split(/\n{2,}|(?<=\.)\s{2,}/).filter(p => p.trim());
  if (paragraphs.length < 2) return text.slice(0, SOURCE_TEXT_BUDGET);

  const kept = new Set<number>();
  let used = 0;
  for (const aboutArtist of [true, false]) {
    paragraphs.forEach((para, i) => {
      if (kept.has(i) || (aboutArtist && !mentionsArtist(para, artistName))) return;
      if (used + para.length > SOURCE_TEXT_BUDGET) return;
      kept.add(i);
      used += para.length;
    });
  }
  if (kept.size === 0) return text.slice(0, SOURCE_TEXT_BUDGET);

  return paragraphs.filter((_, i) => kept.has(i)).join("\n\n");
}
