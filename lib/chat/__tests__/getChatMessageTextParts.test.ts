import { expect, it } from "vitest";
import { getChatMessageTextParts } from "../getChatMessageTextParts";
it("retains bounded passage hints but never mixed generated prose or opaque grants", () => {
  const result = getChatMessageTextParts([
    { type: "data-evidence-mode", data: { version: 1 } },
    { type: "text", text: "Invented billing" },
    ...Array.from({ length: 3 }, () => ({
      type: "data-evidence-passage",
      id: "old",
      data: { text: "The singer is Reinaldo Alvarez.", citation: { url: "https://old.example" } },
    })),
  ]);
  expect(result).toHaveLength(2);
  expect(result[0].text).toContain("untrusted conversation context");
  expect(result[0].text).toContain("Reinaldo Alvarez");
  expect(JSON.stringify(result)).not.toMatch(/Invented|old.example/);
});
it("rejects oversized passage hints and preserves the PDF exclusion", () => {
  expect(
    getChatMessageTextParts([{ type: "data-evidence-passage", data: { text: "x".repeat(6001) } }]),
  ).toEqual([]);
  expect(
    getChatMessageTextParts([{ type: "tool-readNamedPdf" }, { type: "text", text: "old PDF" }]),
  ).toEqual([]);
});
