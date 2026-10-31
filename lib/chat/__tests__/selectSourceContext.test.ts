import { expect, it } from "vitest";
import { selectSourceContext } from "@/lib/chat/selectSourceContext";
it("retains nearby short headings, dates and the whole qualification", () => {
  const text =
    "Title\n\n1975\n\nImage credit\n\nIt was not their first collaboration.\n\nThat attribution remains disputed.";
  expect(selectSourceContext(text, "their first", false)).toBe(text);
});
it("rejects ambiguous, absent, truncated and oversized context instead of cutting it", () => {
  expect(selectSourceContext("Same\n\nSame", "Same", false)).toBeNull();
  expect(selectSourceContext("Other", "missing", false)).toBeNull();
  expect(selectSourceContext("Paragraph ending mid", "ending", true)).toBeNull();
  expect(selectSourceContext("a".repeat(6001), "a".repeat(300), false)).toBeNull();
  expect(
    selectSourceContext("unique-anchor " + "x".repeat(6001), "unique-anchor", false),
  ).toBeNull();
});
