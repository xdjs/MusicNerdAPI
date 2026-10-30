import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { readChatPdf } from "@/lib/chatPdf/readChatPdf";
import { MAX_CHAT_PDF_BYTES } from "@/lib/chatPdf/types";
const bytes = readFileSync(
  new URL("../../vaultUpload/__tests__/fixtures/text.pdf", import.meta.url),
);
const source = {
  id: "s",
  title: "text.pdf",
  url: "https://public.example/text.pdf",
  path: "a/text.pdf",
  size: bytes.length,
  revision: "v1",
  claimId: "c1",
};
afterEach(() => vi.unstubAllGlobals());
it("reads a real original and verifies its physical pages and byte hash without writing text", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array(bytes)));
  vi.stubGlobal("fetch", fetcher);
  const result = await readChatPdf(source);
  expect(result.bytes.equals(bytes)).toBe(true);
  expect(result.pages).toBe(1);
  expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(fetcher).toHaveBeenCalledWith(
    source.url,
    expect.objectContaining({ redirect: "error", cache: "no-store" }),
  );
});
it("rejects changed length, oversized streams and malformed originals", async () => {
  for (const data of [
    Buffer.from("not PDF"),
    Buffer.alloc(MAX_CHAT_PDF_BYTES + 1),
    Buffer.from("%PDF-broken"),
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(data))));
    await expect(readChatPdf({ ...source, size: data.length })).rejects.toThrow();
  }
});
it("does not follow a missing or inaccessible original", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  await expect(readChatPdf(source)).rejects.toThrow("unavailable");
});
