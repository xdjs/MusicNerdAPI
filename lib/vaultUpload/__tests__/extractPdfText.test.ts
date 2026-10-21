import { describe, it, expect, vi, beforeEach } from "vitest";

const { pdfParse } = vi.hoisted(() => ({ pdfParse: vi.fn() }));
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: pdfParse }));
const { extractPdfText } = await import("@/lib/vaultUpload/extractPdfText");

beforeEach(() => {
  pdfParse.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("extractPdfText", () => {
  it("returns the trimmed text", async () => {
    pdfParse.mockResolvedValue({ text: "  A short artist-written document.\n" });
    expect(await extractPdfText(Buffer.from("%PDF"))).toBe("A short artist-written document.");
    expect(pdfParse).toHaveBeenCalledWith(Buffer.from("%PDF"));
  });

  it("is null for an empty or image-only PDF", async () => {
    pdfParse.mockResolvedValue({ text: "   " });
    expect(await extractPdfText(Buffer.from("%PDF"))).toBeNull();
  });

  it("is null when parsing fails, so the upload still succeeds", async () => {
    pdfParse.mockRejectedValue(new Error("bad xref"));
    expect(await extractPdfText(Buffer.from("%PDF"))).toBeNull();
  });

  it("gives up after the parse timeout", async () => {
    vi.useFakeTimers();
    pdfParse.mockReturnValue(new Promise(() => {}));
    const result = extractPdfText(Buffer.from("%PDF"));
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await result).toBeNull();
    vi.useRealTimers();
  });
});
