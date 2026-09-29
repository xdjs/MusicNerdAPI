import { describe, it, expect } from "vitest";
import { verifyClaims } from "@/lib/credits/verifyClaims";
import { ARTIST, HANDLE, POST_URL, credit, post } from "@/lib/credits/__tests__/post";

describe("verifyClaims", () => {
  it("keeps verified credits and statements, and drops the rest", () => {
    const out = verifyClaims(
      {
        credits: [credit(), credit({ subject: "someoneelse" })],
        statements: [
          { quote: "Enjoy 💚", topic: "release day", url: POST_URL },
          { quote: "He hopes listeners enjoy it", topic: "release day", url: POST_URL },
        ],
      },
      [post()],
      ARTIST,
      HANDLE,
    );
    expect(out.credits.map(c => c.subject)).toEqual(["p3t3rango"]);
    expect(out.statements).toEqual([{ quote: "Enjoy 💚", topic: "release day", url: POST_URL }]);
  });

  it("reads at most 60 claims of each kind per batch", () => {
    const out = verifyClaims(
      {
        credits: Array.from({ length: 70 }, () => credit()),
        statements: Array.from({ length: 70 }, () => ({
          quote: "Enjoy 💚",
          topic: "t",
          url: POST_URL,
        })),
      },
      [post()],
      ARTIST,
      HANDLE,
    );
    expect(out.credits).toHaveLength(60);
    expect(out.statements).toHaveLength(60);
  });
});
