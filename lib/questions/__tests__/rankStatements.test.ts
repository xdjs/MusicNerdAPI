import { describe, it, expect } from "vitest";
import { rankStatements } from "@/lib/questions/rankStatements";
import type { ArtistStatement } from "@/lib/credits/types";

const st = (over: Partial<ArtistStatement>): ArtistStatement => ({
  quote: "a statement about something",
  topic: "t",
  url: "https://p/1",
  postedAt: "2026-01-01",
  ...over,
});

describe("rankStatements", () => {
  it("drops a statement whose quote repeats one already kept", () => {
    const out = rankStatements([
      st({ quote: "I discovered web3 and it changed how I think about art entirely", topic: "a" }),
      st({
        quote: "I discovered web3 and it changed how I think about art",
        topic: "b",
        url: "https://p/2",
      }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("lets no single caption own the window", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      st({ quote: `distinct sentence number ${i} about the record`, topic: `t${i}` }),
    );
    expect(rankStatements(many)).toHaveLength(2);
  });

  it("puts a statement that names somebody ahead of one that does not", () => {
    const out = rankStatements([
      st({ quote: "some thoughts about music in general", topic: "vague", url: "https://p/1" }),
      st({
        quote: "I cut this with @zavodskyalan in one night",
        topic: "named",
        url: "https://p/2",
      }),
    ]);
    expect(out[0].topic).toBe("named");
  });

  it("prefers a substantial statement over a throwaway, and newest breaks a tie", () => {
    const out = rankStatements([
      st({ quote: "short one", topic: "short", url: "https://p/1", postedAt: "2020-01-01" }),
      st({ quote: "x".repeat(400), topic: "long", url: "https://p/2", postedAt: "2019-01-01" }),
      st({ quote: "also short", topic: "newer-short", url: "https://p/3", postedAt: "2026-01-01" }),
    ]);
    expect(out[0].topic).toBe("long");
    expect(out[1].topic).toBe("newer-short");
  });

  it("does not rank by recency alone", () => {
    const out = rankStatements([
      st({
        quote: "recent thought one",
        topic: "recentA",
        url: "https://p/1",
        postedAt: "2026-05-10",
      }),
      st({
        quote: "older but I made this with @someone specific",
        topic: "named-old",
        url: "https://p/2",
        postedAt: "2020-01-01",
      }),
    ]);
    expect(out[0].topic).toBe("named-old");
  });
});
