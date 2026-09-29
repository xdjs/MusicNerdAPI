import { describe, it, expect } from "vitest";
import { extractOgImage } from "@/lib/pages/extractOgImage";

describe("extractOgImage", () => {
  it("reads og:image in either attribute order", () => {
    expect(extractOgImage('<meta property="og:image" content="https://i.example/a.jpg">')).toBe(
      "https://i.example/a.jpg",
    );
    expect(extractOgImage('<meta content="https://i.example/b.jpg" property="og:image">')).toBe(
      "https://i.example/b.jpg",
    );
  });

  it("decodes entities before the scheme check, so signed CDN URLs survive", () => {
    expect(
      extractOgImage('<meta property="og:image" content="https://cdn.example/p.jpg?a=1&amp;b=2">'),
    ).toBe("https://cdn.example/p.jpg?a=1&b=2");
  });

  it("rejects anything that is not https", () => {
    expect(
      extractOgImage('<meta property="og:image" content="data:image/png;base64,abc">'),
    ).toBeNull();
    expect(extractOgImage('<meta property="og:image" content="/relative.jpg">')).toBeNull();
    expect(extractOgImage("<html></html>")).toBeNull();
  });
});
