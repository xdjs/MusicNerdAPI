import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { syntheticPdfBytes } from "./syntheticPdfBytes";
import { pdfTextHash } from "../pdfTextHash";
const { readChatPdf } = await import("../readChatPdf");
const bytes = syntheticPdfBytes();
const source = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "archive.pdf",
  url: "https://example.test/archive.pdf",
  path: "archive.pdf",
  revision: "r1",
  claimId: null,
  size: bytes.length,
};
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});
it("read opt-in derives real parser page text from exact fetched bytes without another network request", async () => {
  const output = await readChatPdf(source, undefined, { extractText: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(output.hash).toBe(pdfTextHash(bytes));
  expect(output.textUnavailable).toBe(false);
  expect(output.textManifest?.pages[0].text).toBe("Literal source qualification.");
  expect(output.textManifest?.originalSha256).toBe(output.hash);
});
it("ordinary read does not add page-text output", async () => {
  const output = await readChatPdf(source);
  expect(output).not.toHaveProperty("textManifest");
  expect(output).not.toHaveProperty("textUnavailable");
});
it("actual blank text layer stays explicitly unavailable while native bytes remain usable", async () => {
  const blank = syntheticPdfBytes("");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(blank)),
  );
  const output = await readChatPdf({ ...source, size: blank.length }, undefined, {
    extractText: true,
  });
  expect(output.pages).toBe(1);
  expect(output.textManifest?.physicalPages).toBe(1);
  expect(output.textManifest?.extraction.emptyTextPages).toEqual([1]);
  expect(output.textManifest?.pages[0].text.trim()).toBe("");
  expect(output.textUnavailable).toBe(true);
});
it("read cancellation is not downgraded into a usable unavailable-text result", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      controller.abort();
      return new Response(bytes);
    }),
  );
  await expect(readChatPdf(source, controller.signal, { extractText: true })).rejects.toThrow();
});
