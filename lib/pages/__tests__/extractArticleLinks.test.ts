import { describe, it, expect } from "vitest";
import { extractArticleLinks } from "@/lib/pages/extractArticleLinks";

const BASE = "https://rvamag.com/tags/pete-rango-kevin-carroll";

describe("extractArticleLinks", () => {
  it("finds the article an index page points at", () => {
    const html = `<a href="/community/big-scouse-how-a-liverpool-native.html">Big Scouse</a>`;
    expect(extractArticleLinks(html, BASE)).toEqual([
      "https://rvamag.com/community/big-scouse-how-a-liverpool-native.html",
    ]);
  });

  it("skips other listings", () => {
    const html = `<a href="/tags/something-else">Tag</a><a href="/category/music">C</a>
      <a href="/author/r-anthony-harris">A</a><a href="/page/2">P</a><a href="/feed">RSS</a>
      <a href="/community/a-real-piece.html">Real piece</a>`;
    expect(extractArticleLinks(html, BASE)).toEqual([
      "https://rvamag.com/community/a-real-piece.html",
    ]);
  });

  it("never leaves the host, and never returns the page itself", () => {
    const html = `<a href="https://facebook.com/rvamag">F</a><a href="/tags/pete-rango-kevin-carroll">Self</a>
      <a href="https://rvamag.com/community/piece.html">Piece</a>`;
    expect(extractArticleLinks(html, BASE)).toEqual(["https://rvamag.com/community/piece.html"]);
  });

  it("ignores mailto, tel, javascript and fragments", () => {
    const html = `<a href="mailto:a@b.com">M</a><a href="tel:+1">T</a><a href="javascript:void(0)">J</a><a href="#top">#</a>`;
    expect(extractArticleLinks(html, BASE)).toEqual([]);
  });

  it("dedupes and respects the cap", () => {
    const html =
      Array.from({ length: 40 }, (_, i) => `<a href="/community/p${i}.html">P</a>`).join("") +
      `<a href="/community/p0.html">dup</a>`;
    const out = extractArticleLinks(html, BASE, 5);
    expect(out).toHaveLength(5);
    expect(new Set(out).size).toBe(5);
  });

  it("returns nothing for a malformed base", () => {
    expect(extractArticleLinks('<a href="/x/y.html">x</a>', "not a url")).toEqual([]);
  });
});
