import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractCanvasPdfPages } from "../extractCanvasPdfPages";
it("extracts physical pages from the existing real PDF fixture", async () => {
  const pages = await extractCanvasPdfPages(
    readFileSync("lib/vaultUpload/__tests__/fixtures/text.pdf"),
  );
  expect(pages.length).toBeGreaterThan(0);
  expect(pages.join(" ").trim().length).toBeGreaterThan(0);
});
it("rejects invalid and oversized bytes", async () => {
  await expect(extractCanvasPdfPages(Buffer.from("not pdf"))).rejects.toThrow();
  await expect(extractCanvasPdfPages(Buffer.alloc(2_000_001))).rejects.toThrow();
});
