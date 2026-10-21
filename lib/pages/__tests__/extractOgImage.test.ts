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

it("prefers usable Open Graph and falls back to Twitter metadata", () => {
  expect(
    extractOgImage(
      '<meta name="twitter:image" content="https://cdn.example/twitter.jpg"><meta property="og:image" content="https://cdn.example/og.jpg">',
    ),
  ).toBe("https://cdn.example/og.jpg");
  expect(
    extractOgImage(
      '<meta property="og:image" content="data:bad"><meta content="https://cdn.example/twitter.jpg" name="twitter:image">',
    ),
  ).toBe("https://cdn.example/twitter.jpg");
});
it.each([
  "https://localhost/image",
  "https://localhost./image",
  "https://sub.localhost./image",
  "https://127.0.0.2/image",
  "https://[::]/image",
  "https://100.64.0.1/image",
  "https://10.0.0.1/image",
  "https://user:pass@cdn.example/image",
  "https://cdn.example:8443/image",
])("ignores unsafe image metadata %s", url => {
  expect(extractOgImage(`<meta property="og:image" content="${url}">`)).toBeNull();
});

it("ignores unrelated metadata, comments and script text", () => {
  expect(
    extractOgImage(`<meta name="constructor" content="ignored">
    <!-- <meta property="og:image" content="https://cdn.example/comment.jpg"> -->
    <script>const sample = '<meta property="og:image" content="https://cdn.example/script.jpg">';</script>
    <meta property="og:image" content="https://cdn.example/page.jpg">`),
  ).toBe("https://cdn.example/page.jpg");
});

it("accepts public domain names beginning with IPv6-like letters", () => {
  expect(extractOgImage('<meta property="og:image" content="https://fcdn.example/image">')).toBe(
    "https://fcdn.example/image",
  );
});
