import { MIN_VERIFIED_TEXT } from "@/lib/sources/const";
import { isGroundingRedirect } from "@/lib/sources/isGroundingRedirect";

/**
 * Whether a vault source may be cited in the Lore. Only pages we actually
 * read: `extracted_text` is stored only for a page that passed verification,
 * so its presence is the verification record. A source we never read has a
 * model's description of a search result as its snippet, and citing that
 * presents model output as a verified fact.
 *
 * @param row - The source row.
 * @param row.url - Its URL.
 * @param row.extractedText - The text we read from it, if any.
 * @param row.filePath - Set for an owner-uploaded file.
 * @param row.status - The source's review status.
 * @returns True when the source can back a published claim.
 */
export function isCitableSource(row: {
  url: string;
  extractedText: string | null;
  filePath?: string | null;
  status?: string;
}): boolean {
  if (!row.url || isGroundingRedirect(row.url)) return false;
  // Owner uploads are not scraped navigation pages: short readable text still counts.
  if (row.filePath && row.status === "approved") return !!row.extractedText?.trim();
  return (row.extractedText?.length ?? 0) >= MIN_VERIFIED_TEXT;
}
