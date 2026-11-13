import { describe, expect, it } from "vitest";
import { MAX_CHAT_PDF_BYTES } from "@/lib/chatPdf/types";
import { extractChatPdfText, MAX_CHAT_PDF_TEXT_CHARS } from "@/lib/chatPdf/extractChatPdfText";

/** A two-page PDF with one line of text per page, built by hand (uncompressed objects). */
function tinyPdf(lines: string[]): Buffer {
  const objects: string[] = [];
  const kids = lines.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${lines.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  lines.forEach((line, i) => {
    const content = `BT /F1 12 Tf 20 100 Td (${line}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

describe("extractChatPdfText", () => {
  it("returns the text with a physical page marker before each page", async () => {
    const text = await extractChatPdfText(
      tinyPdf(["Chill Factor credit", "Blue Screen era"]),
      new AbortController().signal,
    );
    expect(text).toMatch(/\[page 1\]\s*Chill Factor credit/);
    expect(text).toMatch(/\[page 2\]\s*Blue Screen era/);
    expect(text.indexOf("[page 1]")).toBeLessThan(text.indexOf("[page 2]"));
  });

  it("yields nothing, never an error, for bytes that are not a PDF, an oversize input or a cancelled read", async () => {
    const live = new AbortController().signal;
    expect(await extractChatPdfText(Buffer.from("not a pdf"), live)).toBe("");
    expect(await extractChatPdfText(new Uint8Array(MAX_CHAT_PDF_BYTES + 1), live)).toBe("");
    const cancelled = new AbortController();
    cancelled.abort();
    expect(await extractChatPdfText(tinyPdf(["x"]), cancelled.signal)).toBe("");
  });

  it("caps the text handed to the model", () => {
    expect(MAX_CHAT_PDF_TEXT_CHARS).toBe(60_000);
  });
});
