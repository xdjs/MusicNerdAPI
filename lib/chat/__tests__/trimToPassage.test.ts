import { describe, expect, test } from "vitest";
import { trimToPassage } from "@/lib/chat/trimToPassage";
import { PASSAGE_CHARS } from "@/lib/units/types";

describe("trimToPassage", () => {
  test("returns a unit at or under the limit whole, whatever the query matches", () => {
    const unit = `${"a".repeat(PASSAGE_CHARS - 12)} Night Label`;
    expect(unit).toHaveLength(PASSAGE_CHARS);
    expect(trimToPassage(unit, "night label")).toBe(unit);
    expect(trimToPassage("short page", "nothing here")).toBe("short page");
  });

  test("returns the window with the most distinct terms, not the first match", () => {
    // The staging case: a common query word matches early, the answering sentence sits late.
    const late = "Night Label released the remix album";
    const text = `${"x".repeat(100)} label ${"y".repeat(6000)} ${late} ${"z".repeat(9000 - 6109 - late.length)}`;
    expect(text).toHaveLength(9000);
    const passage = trimToPassage(text, "Which label released the remix album?");
    expect(passage).toHaveLength(PASSAGE_CHARS);
    expect(passage).toContain(late);
    expect(passage).not.toContain(" label y");
    expect(text).toContain(passage);
  });

  test("starts at the beginning when no term matches", () => {
    const text = "y".repeat(9000);
    expect(trimToPassage(text, "label")).toBe(text.slice(0, PASSAGE_CHARS));
  });

  test("ignores stopwords and terms under three characters", () => {
    // "the" and "of" fill the start; only "alpha" counts, and it sits at the end.
    const text = `${"the of ".repeat(1000)}${"x".repeat(2000)} alpha`;
    expect(trimToPassage(text, "the of alpha")).toBe(text.slice(-PASSAGE_CHARS));
  });

  test("gives a tie to the earliest window", () => {
    const text = `${"x".repeat(100)} alpha ${"y".repeat(7800)} beta ${"z".repeat(1087)}`;
    expect(text).toHaveLength(9000);
    expect(trimToPassage(text, "beta alpha")).toBe(text.slice(0, PASSAGE_CHARS));
  });

  test("keeps the window inside the text at the end", () => {
    const text = `${"x".repeat(9000)} night`;
    expect(trimToPassage(text, "NIGHT")).toBe(text.slice(-PASSAGE_CHARS));
  });

  test("bounds its work on a long text made of one repeated query term", () => {
    // Every term matches at every position; unbounded, this is about a million occurrences.
    const text = "a".repeat(24000);
    const query = Array.from({ length: 40 }, (_, i) => "a".repeat(i + 3)).join(" ");
    const started = performance.now();
    const passage = trimToPassage(text, query);
    expect(performance.now() - started).toBeLessThan(50);
    expect(passage).toHaveLength(PASSAGE_CHARS);
  });
});
