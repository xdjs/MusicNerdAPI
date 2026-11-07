import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { extractOriginalPdfPages } from "../extractOriginalPdfPages";
// Valid one-page PDF built entirely in memory. It is explicitly synthetic, not a retained original.
function fixture() {
  const content = "BT /F1 12 Tf 10 100 Td (Literal source qualification.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let data = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(data));
    data += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(data);
  data += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(o => String(o).padStart(10, "0") + " 00000 n ")
    .join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}
it("extracts actual parser physical-page text bound to original bytes", async () => {
  const bytes = fixture(),
    sha = createHash("sha256").update(bytes).digest("hex");
  const result = await extractOriginalPdfPages(bytes, sha, AbortSignal.timeout(3000));
  expect(result.originalSha256).toBe(sha);
  expect(result.physicalPages).toBe(1);
  expect(result.pages[0].physicalPage).toBe(1);
  expect(result.pages[0].text).toBe("Literal source qualification.");
  expect(result.pages[0].sha256).toBe(
    createHash("sha256").update(result.pages[0].text).digest("hex"),
  );
  expect(result.extraction.visualTextCompleteness).toBe("unverified");
});
it("rejects a different original hash before parsing", async () => {
  await expect(
    extractOriginalPdfPages(fixture(), "a".repeat(64), AbortSignal.timeout(3000)),
  ).rejects.toThrow("hash mismatch");
});
it("rejects already-cancelled extraction without work", async () => {
  const c = new AbortController();
  c.abort();
  await expect(extractOriginalPdfPages(fixture(), "a".repeat(64), c.signal)).rejects.toThrow();
});
