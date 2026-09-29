import { describe, it, expect } from "vitest";
import { correctionsBlock } from "@/lib/lore/correctionsBlock";

describe("correctionsBlock", () => {
  it("is null with no corrections", () => {
    expect(correctionsBlock([])).toBeNull();
  });

  it("states a fix as the artist's version and a wrong claim as a removal", () => {
    const block = correctionsBlock([
      {
        id: "c1",
        claim: "Parris Pierce is his production partner",
        kind: "fix",
        correction: "2018-2019 only.",
      },
      { id: "c2", claim: "He has worked with Black Youngsta", kind: "wrong", correction: null },
      { id: "c3", claim: "A fix with no text", kind: "fix", correction: null },
    ]);
    expect(block).toBe(
      "\n--- CORRECTIONS FROM THE ARTIST (these OVERRIDE the sources above) ---\n" +
        '- WRONG: "Parris Pierce is his production partner"\n  THE ARTIST SAYS: 2018-2019 only.\n' +
        '- REMOVE, the artist says this is not true or not them: "He has worked with Black Youngsta"\n' +
        '- REMOVE, the artist says this is not true or not them: "A fix with no text"\n' +
        "--- END CORRECTIONS ---",
    );
  });
});
