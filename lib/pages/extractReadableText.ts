import { textFrom } from "@/lib/pages/textFrom";

/**
 * The readable text of a page: the article, not the furniture. Chrome is
 * dropped, block structure is kept and entities are decoded. Regex rather than
 * a DOM parse on purpose: a partial result is fine, since whatever survives is
 * judged again downstream.
 *
 * @param bodyHtml - The page's body HTML.
 * @returns The text. A substantial page gutted to almost nothing (its article
 *   was wrapped in an aside or form) keeps its chrome instead of storing nothing.
 */
export function extractReadableText(bodyHtml: string): string {
  const cleaned = textFrom(bodyHtml, true);
  if (cleaned.length < 200) {
    const raw = textFrom(bodyHtml, false);
    if (raw.length > 1000) return raw;
  }
  return cleaned;
}
