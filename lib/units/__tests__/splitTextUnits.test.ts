import { describe, expect, test } from "vitest";
import { splitTextUnits } from "../splitTextUnits";

describe("splitTextUnits", () => {
  test("markdown splits at headings with § locators", () => {
    const units = splitTextUnits(
      "Intro\n\n## Early years\nBorn in 1970.\n\n## Career\nSigned in 1990.",
      "markdown",
    );
    expect(units.map(u => u.locator)).toEqual(["§Top", "§Early years", "§Career"]);
  });
  test("long sections split at paragraphs and number their parts", () => {
    const units = splitTextUnits("## A\n" + "para\n\n".repeat(50), "markdown", 100);
    expect(units[0].locator).toBe("§A");
    expect(units[1].locator).toBe("§A (2)");
    expect(units.every(u => u.text.length <= 100)).toBe(true);
  });
  test("plain text uses paragraph locators", () => {
    expect(splitTextUnits("one\n\ntwo\n\nthree", "plain", 8).map(u => u.locator)).toEqual([
      "¶1",
      "¶2",
      "¶3",
    ]);
  });
  test("plain paragraphs group up to maxChars and locate at the first paragraph", () => {
    const units = splitTextUnits("aa\n\nbb\n\ncc\n\ndd", "plain", 8);
    expect(units.map(u => u.locator)).toEqual(["¶1", "¶3"]);
    expect(units[0].text).toBe("aa\n\nbb");
  });
  test("a single paragraph longer than maxChars is cut at maxChars", () => {
    const units = splitTextUnits("x".repeat(250), "plain", 100);
    expect(units.map(u => u.text.length)).toEqual([100, 100, 50]);
    expect(units.map(u => u.locator)).toEqual(["¶1", "¶1 (2)", "¶1 (3)"]);
  });
  test("heading text drops the # marks and is trimmed", () => {
    const units = splitTextUnits("#   Big title  \nbody", "markdown");
    expect(units.map(u => u.locator)).toEqual(["§Big title"]);
  });
  test("no headings yields only §Top", () => {
    expect(splitTextUnits("just text", "markdown").map(u => u.locator)).toEqual(["§Top"]);
  });
  test("empty input yields no units", () => {
    expect(splitTextUnits("   ", "plain")).toEqual([]);
    expect(splitTextUnits("", "markdown")).toEqual([]);
  });
  test("CRLF text splits into paragraphs like LF text", () => {
    expect(splitTextUnits("one\r\n\r\ntwo\r\n\r\nthree", "plain", 8)).toEqual([
      { locator: "¶1", text: "one" },
      { locator: "¶2", text: "two" },
      { locator: "¶3", text: "three" },
    ]);
    const units = splitTextUnits("Intro\r\n\r\n## Career\r\nSigned.\r\n\r\nTour.", "markdown");
    expect(units.map(u => u.locator)).toEqual(["§Top", "§Career"]);
    expect(units[1].text).toBe("Signed.\n\nTour.");
  });
  test("closing # marks are stripped from heading text", () => {
    expect(splitTextUnits("## Early years ##\nBorn.", "markdown").map(u => u.locator)).toEqual([
      "§Early years",
    ]);
  });
  test("a heading line of # plus 100000 spaces parses promptly", () => {
    const start = Date.now();
    const units = splitTextUnits("#" + " ".repeat(100000) + "x\nbody", "markdown");
    const units2 = splitTextUnits("# " + "# ".repeat(50000) + "x\nbody", "markdown");
    expect(Date.now() - start).toBeLessThan(500);
    expect(units.map(u => u.text)).toEqual(["body"]);
    expect(units2.map(u => u.text)).toEqual(["body"]);
  });
});
