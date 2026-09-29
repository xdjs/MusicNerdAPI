import { describe, it, expect } from "vitest";
import { isCitableSource } from "@/lib/sources/isCitableSource";

const page = "x".repeat(400);

describe("isCitableSource", () => {
  it("cites a page whose text we read, and not one we never read", () => {
    expect(isCitableSource({ url: "https://a.example/x", extractedText: page })).toBe(true);
    expect(isCitableSource({ url: "https://a.example/x", extractedText: "x".repeat(399) })).toBe(
      false,
    );
    expect(isCitableSource({ url: "https://a.example/x", extractedText: null })).toBe(false);
  });

  it("never cites a grounding redirect or a row without a URL", () => {
    expect(
      isCitableSource({
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a",
        extractedText: page,
      }),
    ).toBe(false);
    expect(isCitableSource({ url: "", extractedText: page })).toBe(false);
  });

  it("cites a short approved upload that has readable text", () => {
    const upload = { url: "https://a.example/f.pdf", filePath: "a/f.pdf", status: "approved" };
    expect(isCitableSource({ ...upload, extractedText: "short but real" })).toBe(true);
    expect(isCitableSource({ ...upload, extractedText: "  " })).toBe(false);
  });
});
