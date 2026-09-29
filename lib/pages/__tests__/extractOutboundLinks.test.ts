import { describe, it, expect } from "vitest";
import { extractOutboundLinks } from "@/lib/pages/extractOutboundLinks";

describe("extractOutboundLinks", () => {
  it("keeps only off-host http(s) links, deduped, without fragments", () => {
    const html = `<a href="https://instagram.com/dupesdidit#x">IG</a><a href="https://instagram.com/dupesdidit">IG</a>
      <a href="/about">Self</a><a href="https://dupes.rocks/shop">Self</a><a href="ftp://x.example/f">F</a>
      <a href="mailto:a@b.c">M</a><a href="https://soundcloud.com/dupes">SC</a>`;
    expect(extractOutboundLinks(html, "https://dupes.rocks/")).toEqual([
      "https://instagram.com/dupesdidit",
      "https://soundcloud.com/dupes",
    ]);
  });

  it("respects the cap and a malformed base", () => {
    const html = Array.from(
      { length: 30 },
      (_, i) => `<a href="https://s${i}.example/">s</a>`,
    ).join("");
    expect(extractOutboundLinks(html, "https://a.example/")).toHaveLength(25);
    expect(extractOutboundLinks(html, "https://a.example/", 3)).toHaveLength(3);
    expect(extractOutboundLinks(html, "nope")).toEqual([]);
  });
});
