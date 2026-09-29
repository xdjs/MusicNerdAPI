import { describe, it, expect } from "vitest";
import { pushEvidence } from "@/lib/socialSignals/pushEvidence";

describe("pushEvidence", () => {
  it("adds a new URL once and caps the list at five", () => {
    const urls: string[] = [];
    for (const u of ["a", "a", "b", "c", "d", "e", "f"]) pushEvidence(urls, u);
    expect(urls).toEqual(["a", "b", "c", "d", "e"]);
  });
});
