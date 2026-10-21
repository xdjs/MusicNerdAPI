import { it, expect } from "vitest";
import { csvCell } from "@/lib/knowledgeExport/csvCell";

it("quotes every cell and doubles inner quotes", () => {
  expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
  expect(csvCell(3)).toBe('"3"');
  expect(csvCell(null)).toBe('""');
});
