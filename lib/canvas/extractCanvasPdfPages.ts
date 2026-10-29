import pdfParse from "pdf-parse/lib/pdf-parse.js";
/** Extract physical PDF pages with bounded input/page/text limits; no OCR or invented page text. */
export async function extractCanvasPdfPages(bytes: Buffer): Promise<string[]> {
  if (bytes.length > 2_000_000 || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Invalid preview PDF");
  const pages: string[] = [];
  let total = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const parsed = await Promise.race([
      pdfParse(new Uint8Array(bytes), {
        max: 20,
        pagerender: async (page: {
          getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
        }) => {
          const content = await page.getTextContent();
          let y: number | undefined;
          let text = "";
          for (const item of content.items) {
            if (typeof item.str !== "string") continue;
            const nextY = item.transform?.[5];
            text += (text ? (y === nextY ? "" : "\n") : "") + item.str;
            y = nextY;
          }
          text = text.trim();
          total += text.length;
          if (text.length > 18000 || total > 120000)
            throw new Error("PDF text exceeds preview limit");
          pages.push(text);
          return text;
        },
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("PDF extraction timeout")), 10000);
      }),
    ]);
    if (parsed.numpages > 20 || pages.length !== parsed.numpages || total > 120000)
      throw new Error("Incomplete PDF extraction");
    return pages;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
