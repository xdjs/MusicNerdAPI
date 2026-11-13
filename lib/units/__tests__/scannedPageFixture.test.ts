import { readFileSync, statSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { extractPdfPages } from "@/lib/units/extractPdfPages";

const FIXTURE = new URL("./fixtures/scanned-page.pdf", import.meta.url);

describe("scanned-page fixture", () => {
  test("is one page with no text layer, so only the vision pass can read it", async () => {
    const { pages } = await extractPdfPages(new Uint8Array(readFileSync(FIXTURE)));
    expect(pages).toHaveLength(1);
    expect(pages[0].trim()).toBe("");
  });

  test("stays small enough to commit", () => {
    expect(statSync(FIXTURE).size).toBeLessThan(50_000);
  });
});
