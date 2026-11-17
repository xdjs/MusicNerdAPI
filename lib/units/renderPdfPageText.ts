/** The slice of pdf.js's page proxy the renderer reads. */
export type PdfPageData = {
  pageNumber?: number;
  getTextContent: (options?: unknown) => Promise<{
    items: { str: string; transform: number[] }[];
  }>;
};

/**
 * pdf-parse's default page renderer: items on one baseline are joined, a change
 * in y starts a new line. Shared so the ingest index and the chat eval's
 * evidence render a page identically.
 *
 * @param pageData - The pdf.js page handed to pdf-parse's `pagerender`.
 * @returns The page's text, untrimmed and without any page marker.
 */
export async function renderPdfPageText(pageData: PdfPageData): Promise<string> {
  const content = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });
  let lastY: number | undefined;
  let text = "";
  for (const item of content.items) {
    text += lastY === item.transform[5] || lastY === undefined ? item.str : `\n${item.str}`;
    lastY = item.transform[5];
  }
  return text;
}
