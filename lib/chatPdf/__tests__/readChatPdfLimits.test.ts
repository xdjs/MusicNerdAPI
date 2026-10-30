import { readChatPdf } from "@/lib/chatPdf/readChatPdf";
import { afterEach, expect, it, vi } from "vitest";
const parse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chatPdf/inspectChatPdf", () => ({ inspectChatPdf: parse }));
const bytes = Buffer.from("%PDF-test");
const source = {
  id: "s",
  title: "x.pdf",
  url: "https://public.example/x.pdf",
  path: "a/x.pdf",
  size: bytes.length,
  revision: "v1",
  claimId: "c",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("accepts the existing 41-page case but rejects a PDF beyond the 50-page bound", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => new Response(new Uint8Array(bytes))),
  );
  parse.mockResolvedValueOnce(41);
  expect((await readChatPdf(source)).pages).toBe(41);
  parse.mockResolvedValueOnce(51);
  await expect(readChatPdf(source)).rejects.toThrow("page limit");
});
it("cancellation while inspecting cannot produce model content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => new Response(new Uint8Array(bytes))),
  );
  parse.mockImplementation(() => new Promise(() => {}));
  const cancel = new AbortController();
  const reading = readChatPdf(source, cancel.signal);
  const rejected = expect(reading).rejects.toThrow();
  cancel.abort();
  await rejected;
});
