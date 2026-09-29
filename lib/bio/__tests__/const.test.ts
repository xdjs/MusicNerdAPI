import { describe, it, expect } from "vitest";
import {
  ABOUT_LENGTH_RULE,
  ABOUT_OPENING_RULE,
  ABOUT_STOP_RULE,
  ABOUT_TARGET_WORDS,
  MAX_BIO_LENGTH,
} from "@/lib/bio/const";

describe("bio constants", () => {
  it("match MusicNerdWeb's prompt rules and caps", () => {
    expect(MAX_BIO_LENGTH).toBe(10_000);
    expect(ABOUT_TARGET_WORDS).toBe(100);
    expect(ABOUT_LENGTH_RULE).toContain("ONE paragraph, up to ~100 words");
    expect(ABOUT_STOP_RULE).toBe(
      'Stop when the facts run out. No closing "significance" flourish.',
    );
    expect(ABOUT_OPENING_RULE).toMatch(/^Establish who they are in the first sentence/);
  });
});
