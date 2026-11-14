import { describe, expect, test } from "vitest";
import { isBrokenExtraction } from "../isBrokenExtraction";

describe("isBrokenExtraction", () => {
  test("near-empty text is broken", () => {
    expect(isBrokenExtraction("p. 3")).toBe(true);
  });
  test("fused words are broken", () => {
    expect(isBrokenExtraction("thequickbrownfoxjumpsoverthelazydogagainandagain ".repeat(5))).toBe(
      true,
    );
  });
  test("ordinary prose is not broken", () => {
    expect(isBrokenExtraction("The quick brown fox jumps over the lazy dog. ".repeat(5))).toBe(
      false,
    );
  });
  test("symbol noise is broken", () => {
    expect(isBrokenExtraction("ab ����� ".repeat(30))).toBe(true);
  });
  test("accented names are not noise", () => {
    expect(
      isBrokenExtraction("Björk Guðmundsdóttir és Sigur Rós zenéje Café Tacvba señor ".repeat(4)),
    ).toBe(false);
  });
  test("exactly 40 word characters is kept", () => {
    expect(isBrokenExtraction("abcd ".repeat(10))).toBe(false);
    expect(isBrokenExtraction("abcd ".repeat(9) + "abc")).toBe(true);
  });
});
