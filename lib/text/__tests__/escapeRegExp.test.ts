import { describe, it, expect } from "vitest";
import { escapeRegExp } from "@/lib/text/escapeRegExp";

describe("escapeRegExp", () => {
  it("escapes every regex metacharacter so the text matches literally", () => {
    const raw = "a.b*c+d?e^f${g}(h)|[i]\\j";
    expect(new RegExp(escapeRegExp(raw)).test(raw)).toBe(true);
    expect(escapeRegExp("dc.date.issued")).toBe("dc\\.date\\.issued");
  });
});
