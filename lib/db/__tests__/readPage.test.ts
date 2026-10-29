import { describe, expect, it } from "vitest";
import { readPage } from "@/lib/db/readPage";

const params = (query: string) => new URL(`https://api.musicnerd.test/x${query}`).searchParams;

describe("readPage", () => {
  it("reads a positive page", () => {
    expect(readPage(params("?page=3"))).toBe(3);
  });

  it.each(["", "?page=", "?page=0", "?page=-1", "?page=1.5", "?page=abc"])(
    "answers 1 for %j",
    query => {
      expect(readPage(params(query))).toBe(1);
    },
  );
});
