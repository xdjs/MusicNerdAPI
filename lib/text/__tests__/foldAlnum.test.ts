import { describe, it, expect } from "vitest";
import { foldAlnum } from "@/lib/text/foldAlnum";

describe("foldAlnum", () => {
  it("keeps lowercase letters and digits only", () => {
    expect(foldAlnum("Black Dave MK2")).toBe("blackdavemk2");
    expect(foldAlnum("@dupes.did_it")).toBe("dupesdidit");
  });

  it("does not decompose accents (unlike foldName) and tolerates nullish input", () => {
    expect(foldAlnum("Rós")).toBe("rs");
    expect(foldAlnum(undefined as unknown as string)).toBe("");
  });
});
