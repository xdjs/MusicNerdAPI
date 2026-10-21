import { describe, it, expect } from "vitest";
import { storedImage } from "@/lib/account/storedImage";

describe("storedImage", () => {
  it.each([
    ["/uploaded.png", "/uploaded.png"],
    [" https://cdn.example.test/a.png ", "https://cdn.example.test/a.png"],
    ["//other.test/picture", null],
    ["/path\\with\\backslash", null],
    ["http://insecure.test/a.png", null],
    ["https://user:pass@cdn.example.test/a.png", null],
    ["javascript:alert(1)", null],
    ["not a url", null],
    ["", null],
    [null, null],
  ])("%j → %j", (value, expected) => {
    expect(storedImage(value)).toBe(expected);
  });
});
