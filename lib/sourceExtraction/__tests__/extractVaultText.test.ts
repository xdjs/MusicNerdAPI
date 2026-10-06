import { describe, expect, it } from "vitest";
import { extractVaultText } from "@/lib/sourceExtraction/extractVaultText";

describe("extractVaultText", () => {
  it("uses the article instead of unrelated recommendations and quoted HTML attributes", () => {
    const html = `<html><body><nav>Account settings</nav><article><h1>An artist interview</h1><p data-show="x > 1">I arranged <em>this</em> song &amp; kept its ending.</p><p>But that was only a demo.</p></article><section>Another artist won an award.</section></body></html>`;
    expect(extractVaultText(html)).toEqual({
      text: "An artist interview\n\nI arranged this song & kept its ending.\n\nBut that was only a demo.",
      scope: "article",
      totalChars: 87,
      truncated: false,
    });
  });
  it("keeps inline words together, paragraph order, Unicode and quotations", () => {
    const r = extractVaultText(
      "<main><p>“café 🎹” <span>was not</span> a finished record.</p><p>Second answer.</p><script>fake evidence</script><div hidden>Hidden</div></main>",
    );
    expect(r.text).toBe("“café 🎹” was not a finished record.\n\nSecond answer.");
    expect(r.scope).toBe("main");
  });
  it("does not invent evidence from metadata or an empty script app", () => {
    expect(
      extractVaultText(
        '<html><head><title>Artist makes a claim</title><meta name="description" content="A biography"></head><body><script>Artist statement</script></body></html>',
      ).text,
    ).toBe("");
  });
  it("caps stored text without splitting a surrogate pair and records full length", () => {
    const r = extractVaultText(`<article>${"a".repeat(49_999)}🎹x</article>`);
    expect(r.text).toHaveLength(49_999);
    expect(r.totalChars).toBe(50_002);
    expect(r.truncated).toBe(true);
  });
});
