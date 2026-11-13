import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.hoisted(() => vi.fn());
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: parse }));
const { readPdfChatEvidence } = await import("@/lib/evals/readPdfChatEvidence");

const bytes = Buffer.from("%PDF-synthetic-bytes");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const url = "https://public.example/vault-files/a/timeline.pdf";
const output = { sourceId: "s1", n: 1, title: "timeline.pdf", pages: 2, sha256 };

const page = (pageNumber: number, lines: string[]) => ({
  pageNumber,
  getTextContent: async () => ({
    items: lines.map((str, i) => ({ str, transform: [0, 0, 0, 0, 0, 100 - i * 10] })),
  }),
});

beforeEach(() => {
  parse.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes, { status: 200 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("readPdfChatEvidence", () => {
  it("fetches the cited original, verifies the bytes the model saw, and keeps page markers", async () => {
    parse.mockImplementation(
      async (_buffer: Buffer, options: { pagerender: (p: unknown) => Promise<string> }) => {
        const text = [
          await options.pagerender(page(1, ["Aliases:", "Dutchmassive 1998-present"])),
          await options.pagerender(page(2, ["2001 We're Here Now (as The Chill Factor)"])),
        ].join("");
        return { numpages: 2, text };
      },
    );
    const evidence = await readPdfChatEvidence("readPdfSource", "call-1", output, url);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ n: 1, url, tool: "readPdfSource", toolCallId: "call-1" });
    expect(evidence[0].text).toContain("[page 1]\nAliases:\nDutchmassive 1998-present");
    expect(evidence[0].text).toContain("[page 2]\n2001 We're Here Now (as The Chill Factor)");
    expect(evidence[0].sha256).toBe(createHash("sha256").update(evidence[0].text).digest("hex"));
    expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "error" }));
  });

  it("returns nothing when the bytes differ from the tool's hash, the output is an error, or the tool is not a PDF read", async () => {
    parse.mockResolvedValue({ numpages: 1, text: "x" });
    expect(
      await readPdfChatEvidence("readPdfSource", "c", { ...output, sha256: "0".repeat(64) }, url),
    ).toEqual([]);
    expect(
      await readPdfChatEvidence("readPdfSource", "c", { error: "PDF unavailable" }, url),
    ).toEqual([]);
    expect(await readPdfChatEvidence("readSource", "c", output, url)).toEqual([]);
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns nothing when the fetch fails or the parser throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    expect(await readPdfChatEvidence("readNamedPdf", "c", output, url)).toEqual([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes, { status: 200 })),
    );
    parse.mockRejectedValue(new Error("bad pdf"));
    expect(await readPdfChatEvidence("readNamedPdf", "c", output, url)).toEqual([]);
  });
});
