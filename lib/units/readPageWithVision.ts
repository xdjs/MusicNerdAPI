import { MODEL_OCR } from "@/lib/ai/const";
import { generateText } from "@/lib/ai/generateText";

const INSTRUCTION =
  "Transcribe every word on this page as markdown. Keep headings, lists and tables. Return only the transcription. If the page has no text, reply exactly: [blank page]";
const BLANK_PAGE = "[blank page]";

/**
 * Has the vision model transcribe one PDF page, for pages whose text layer is
 * missing or unreadable.
 *
 * @param pageBytes - A one-page PDF (see `sliceLoadedPdfPage`).
 * @param opts - An abort signal, and a model id to use instead of `MODEL_OCR`.
 * @returns The page as trimmed markdown; an empty string for a page with no text (the model's
 * `[blank page]` marker, or an empty reply), which is not an error.
 */
export async function readPageWithVision(
  pageBytes: Uint8Array,
  opts: { signal?: AbortSignal; model?: string } = {},
): Promise<string> {
  const { text } = await generateText({
    model: opts.model ?? MODEL_OCR,
    prompt: [
      {
        role: "user",
        content: [
          { type: "text", text: INSTRUCTION },
          { type: "file", data: pageBytes, mediaType: "application/pdf" },
        ],
      },
    ],
    abortSignal: opts.signal,
  });
  const transcription = text.trim();
  return transcription.toLowerCase() === BLANK_PAGE ? "" : transcription;
}
