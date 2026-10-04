import { expect, it } from "vitest";
import { locateInterviewQuote } from "../locateInterviewQuote";
it("resolves layout whitespace back to exact original offsets without allowing changed words", () => {
  const text = "Before. The artist\n  kept [the drums] and\tvoice. After.";
  const quote = "The artist kept [the drums] and voice.";
  const span = locateInterviewQuote(text, quote)!;
  expect(text.slice(span.start, span.end)).toBe("The artist\n  kept [the drums] and\tvoice.");
  expect(locateInterviewQuote(text, "The artist kept the bass and voice.")).toBeNull();
  expect(locateInterviewQuote(text, "")).toBeNull();
});
