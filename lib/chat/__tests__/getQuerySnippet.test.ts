import { describe, it, expect } from "vitest";
import { getQuerySnippet } from "@/lib/chat/getQuerySnippet";

const filler = (n: number) => "lorem ipsum dolor sit amet ".repeat(n);

describe("getQuerySnippet", () => {
  it("returns the passage where the query's words cluster, not the page's start", () => {
    const text = `${filler(40)}The band formed in Richmond in 1991 and still plays salsa. ${filler(40)}`;

    const snippet = getQuerySnippet(text, "When was Bio Ritmo formed in Richmond?", 120);

    expect(snippet).toContain("formed in Richmond in 1991");
    expect(snippet.length).toBeLessThanOrEqual(120);
  });

  it("prefers the window with the most distinct query words", () => {
    const text = `Richmond ${filler(30)} formed ${filler(30)} formed in Richmond, 1991 ${filler(30)}`;

    expect(getQuerySnippet(text, "formed Richmond", 60)).toContain("formed in Richmond, 1991");
  });

  it("falls back to the start when no query word appears", () => {
    expect(getQuerySnippet("Alpha beta gamma delta", "trombone", 10)).toBe("Alpha beta");
  });
});
