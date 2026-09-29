import { describe, it, expect } from "vitest";
import { toCreditRows } from "@/lib/credits/toCreditRows";

describe("toCreditRows", () => {
  it("turns credits and statements into artist_social_credits rows, dated by their post", () => {
    const rows = toCreditRows(
      "a1",
      {
        credits: [
          {
            subject: "p3t3rango",
            isHandle: true,
            role: "Mixed by",
            quote: "q1",
            url: "u1",
            isSelf: false,
          },
        ],
        statements: [{ quote: "q2", topic: "the pandemic", url: "u2" }],
      },
      new Map([["u1", "2025-12-19T15:00:00.000Z"]]),
    );
    expect(rows).toEqual([
      {
        artistId: "a1",
        kind: "credit",
        subject: "p3t3rango",
        isHandle: true,
        isSelf: false,
        label: "Mixed by",
        quote: "q1",
        sourceUrl: "u1",
        postedAt: "2025-12-19T15:00:00.000Z",
      },
      {
        artistId: "a1",
        kind: "statement",
        subject: null,
        isHandle: false,
        isSelf: false,
        label: "the pandemic",
        quote: "q2",
        sourceUrl: "u2",
        postedAt: null,
      },
    ]);
  });
});
