import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";

// The real parser, unlike extractPdfText.test.ts: only storage is faked.
const { storageFetch } = vi.hoisted(() => ({ storageFetch: vi.fn() }));
vi.mock("@/lib/storage/storageFetch", () => ({ storageFetch }));
const { downloadObject } = await import("@/lib/storage/downloadObject");
const { extractPdfText } = await import("@/lib/vaultUpload/extractPdfText");

const fixture = readFileSync(new URL("./fixtures/text.pdf", import.meta.url));

beforeEach(() => {
  storageFetch.mockReset();
});

describe("extractPdfText with a real PDF", () => {
  it("reads a small PDF downloaded from storage while Node's Buffer pool holds other bytes", async () => {
    storageFetch.mockResolvedValueOnce(new Response(new Uint8Array(fixture)));
    const buffer = await downloadObject("lore-uploads", "a1/text.pdf");
    // In a running server, Node's shared Buffer pool starts with other bytes
    // when pdf.js copies a small PDF into it. Start a pool with junk.
    let junk: Buffer;
    do junk = Buffer.allocUnsafe(Buffer.poolSize / 2 - 1).fill("x");
    while (junk.byteOffset !== 0);

    expect(await extractPdfText(buffer)).toBe("Bio Ritmo is a salsa band from Richmond, Virginia.");
  });
});
