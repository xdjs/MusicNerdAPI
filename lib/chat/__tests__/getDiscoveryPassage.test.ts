import { expect, it } from "vitest";
import { getDiscoveryPassage } from "../getDiscoveryPassage";

it("retains leading chronology and qualification around a later match", () => {
  const text =
    "Unrelated date 2020. ".repeat(20) +
    "\n\n1975\n\n" +
    "Background. ".repeat(18) +
    "Mara recorded with Sol, but the source does not specify billing.\n\n1976\n" +
    "Other section. ".repeat(90);
  const anchor = text.indexOf("Mara");
  const result = getDiscoveryPassage(text, { start: 0, end: 1600, anchor });
  expect(result.text).toBe(text.slice(result.start, result.end));
  expect(result.text).toContain("1975\n\n");
  expect(result.text).toContain("does not specify billing.");
  expect(result.text.length).toBeLessThanOrEqual(800);
  expect(result.truncated).toBe(true);
});

it("keeps short windows intact and long unbroken paragraphs bounded with honest truncation", () => {
  expect(getDiscoveryPassage("Short complete passage.", { start: 0, end: 23, anchor: 6 })).toEqual({
    text: "Short complete passage.",
    start: 0,
    end: 23,
    truncated: false,
    contextIncomplete: false,
  });
  const text = "x".repeat(900) + "WITNESS " + "y".repeat(800);
  const result = getDiscoveryPassage(text, { start: 0, end: 1600, anchor: 900 });
  expect(result.text).toContain("WITNESS");
  expect(result.text.length).toBeLessThanOrEqual(800);
  expect(result.truncated).toBe(true);
  expect(result.contextIncomplete).toBe(true);
});

it("stays inside the ranked window and preserves Unicode pairs", () => {
  const text = "😀".repeat(2000);
  const result = getDiscoveryPassage(text, { start: 800, end: 2400, anchor: 1600 });
  expect(result.start).toBeGreaterThanOrEqual(800);
  expect(result.end).toBeLessThanOrEqual(2400);
  expect(result.text).toBe(text.slice(result.start, result.end));
  expect(result.text.length).toBeLessThanOrEqual(800);
  expect(result.start % 2).toBe(0);
  expect(result.end % 2).toBe(0);
});

it("uses adjacent preceding lines when no blank-line blocks exist, without appending later sections", () => {
  const text =
    "Earlier unrelated date 1990.\nGoverning heading 2002\nMatch carries a qualification.\nLater section 2020\n";
  const result = getDiscoveryPassage(text, {
    start: 0,
    end: text.length,
    anchor: text.indexOf("Match"),
  });
  expect(result.text).toBe(
    "Earlier unrelated date 1990.\nGoverning heading 2002\nMatch carries a qualification.",
  );
  expect(result.text).not.toContain("Later section");
  expect(result.text).toBe(text.slice(result.start, result.end));
});
