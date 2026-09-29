import { describe, it, expect } from "vitest";
import { extractReadableText } from "@/lib/pages/extractReadableText";

describe("extractReadableText", () => {
  it("keeps blank lines between blocks, so paragraph selection can run at all", () => {
    const text = extractReadableText(
      "<p>First paragraph about the artist.</p><p>Second paragraph.</p>",
    );
    expect(text.split(/\n{2,}/).length).toBeGreaterThan(1);
    expect(text).toContain("First paragraph about the artist.");
  });

  it("drops a cookie-consent form", () => {
    const text = extractReadableText(`
      <article><p>Pete Rango produced the record in Miami.</p></article>
      <form id="cookie-prefs"><p>Manage your cookie preferences below:</p>
      <p>_ga ID used to identify users 2 years</p><button>Accept All</button></form>`);
    expect(text).toContain("Pete Rango produced the record in Miami.");
    expect(text).not.toMatch(/cookie preferences/i);
    expect(text).not.toContain("_ga ID");
  });

  it("drops nav, footer, aside and comment forms", () => {
    const text = extractReadableText(`
      <nav><a href="/">Home</a></nav><article><p>The interview itself.</p></article>
      <aside><p>Meet Chelsea Jay</p></aside><form><label>Comment *</label></form>
      <footer><p>Terms Privacy Contact Us</p></footer>`);
    expect(text).toContain("The interview itself.");
    expect(text).not.toContain("Meet Chelsea Jay");
    expect(text).not.toContain("Terms Privacy");
    expect(text).not.toContain("Comment *");
  });

  it("decodes entities", () => {
    const text = extractReadableText(
      "<p>to touch people&#8217;s souls, he &quot;said&quot;&nbsp;once</p>",
    );
    expect(text).toContain("to touch people’s souls");
    expect(text).toContain('"said"');
  });

  it("keeps a substantial article wrapped in chrome rather than storing nothing", () => {
    const body = `<aside><p>${"Real article text about the artist. ".repeat(40)}</p></aside>`;
    expect(extractReadableText(body)).toContain("Real article text about the artist.");
  });

  it("leaves a short page stripped rather than putting its nav back", () => {
    expect(
      extractReadableText("<nav>Home About Contact</nav><p>A brief note about the record.</p>"),
    ).toBe("A brief note about the record.");
  });

  it("does not cut a sentence at an inline tag", () => {
    expect(
      extractReadableText("<p>He worked with <a href='#'>Cherele</a> on the track.</p>"),
    ).toContain("He worked with Cherele on the track.");
  });
});
