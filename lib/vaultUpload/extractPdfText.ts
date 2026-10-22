import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { PDF_PARSE_TIMEOUT_MS } from "@/lib/vaultUpload/const";

/**
 * The text of a PDF, for Lore. Null on failure, timeout or an empty result,
 * so the upload still succeeds: the file is stored regardless, only its text
 * context is lost.
 *
 * @param buffer - The PDF's bytes.
 * @returns The trimmed text, or null.
 */
export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const result = await Promise.race([
      pdfParse(buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PDF parse timeout")), PDF_PARSE_TIMEOUT_MS),
      ),
    ]);
    const text = result.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error("[extractPdfText] Failed to parse PDF:", err);
    return null;
  }
}
