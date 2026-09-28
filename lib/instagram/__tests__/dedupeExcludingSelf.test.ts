import { describe, it, expect } from "vitest";
import { dedupeExcludingSelf } from "@/lib/instagram/dedupeExcludingSelf";

describe("dedupeExcludingSelf", () => {
  it("drops the artist and duplicates by normalized handle, keeping first spelling", () => {
    expect(
      dedupeExcludingSelf(["@Dear_Rod", "p3t3rango", "dear_rod", " pressurefiles "], "p3t3rango"),
    ).toEqual(["Dear_Rod", "pressurefiles"]);
  });

  it("drops blank handles", () => {
    expect(dedupeExcludingSelf(["  ", "@"], "self")).toEqual([]);
  });
});
