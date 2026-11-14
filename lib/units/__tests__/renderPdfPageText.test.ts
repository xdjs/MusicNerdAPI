import { describe, expect, test } from "vitest";
import { renderPdfPageText } from "@/lib/units/renderPdfPageText";

const page = (items: { str: string; y: number }[]) => ({
  getTextContent: async () => ({
    items: items.map(({ str, y }) => ({ str, transform: [1, 0, 0, 1, 0, y] })),
  }),
});

describe("renderPdfPageText", () => {
  test("joins items on the same line and breaks on a y change", async () => {
    const text = await renderPdfPageText(
      page([
        { str: "Hello ", y: 700 },
        { str: "world", y: 700 },
        { str: "Next line", y: 680 },
      ]),
    );
    expect(text).toBe("Hello world\nNext line");
  });

  test("renders an empty page as an empty string", async () => {
    expect(await renderPdfPageText(page([]))).toBe("");
  });
});
