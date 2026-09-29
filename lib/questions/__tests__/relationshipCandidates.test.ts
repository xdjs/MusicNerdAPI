import { describe, it, expect } from "vitest";
import { relationshipCandidates } from "@/lib/questions/relationshipCandidates";
import { EXTRACTION } from "@/lib/questions/__tests__/extraction";

describe("relationshipCandidates", () => {
  it("lists partnerships, then same-post joins", () => {
    expect(relationshipCandidates("Pharaoh", EXTRACTION).map(c => c.signalId)).toEqual([
      "partnership_p3t3rango",
      "same_post_B",
    ]);
  });
});
