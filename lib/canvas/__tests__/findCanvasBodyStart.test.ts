import { expect, it } from "vitest";
import { findCanvasBodyStart } from "../findCanvasBodyStart";
it("skips the observed website navigation prefix while preserving original offsets", () => {
  const text =
    "0 Skip to Content English English Salsa System Electric Cowbell Fall 2022, 10” Vinyl 2006, Demo EP";
  expect(text.slice(findCanvasBodyStart(text))).toBe(
    "Salsa System Electric Cowbell Fall 2022, 10” Vinyl 2006, Demo EP",
  );
  const gallery =
    "0\nSkip to Content\nEnglish\nEnglish\nView fullsize\nView fullsize\n2022 Photos by Mauricio Castro";
  expect(gallery.slice(findCanvasBodyStart(gallery))).toBe("2022 Photos by Mauricio Castro");
});
it("does not remove artist prose mentioning navigation words or music language", () => {
  for (const text of [
    "English folk music shaped this record.",
    "Home is where I recorded the album.",
    "Skip to Content is the title of this work.",
    "In 2022 we changed direction.",
  ])
    expect(findCanvasBodyStart(text)).toBe(0);
});
it("returns the end for navigation-only extractions", () => {
  const text = "0 Skip to Content English English View fullsize";
  expect(findCanvasBodyStart(text)).toBe(text.length);
});
