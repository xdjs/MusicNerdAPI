import { describe, it, expect } from "vitest";
import { claimApprovedEmailHtml } from "@/lib/email/claimApprovedEmailHtml";

describe("claimApprovedEmailHtml", () => {
  it("names the artist, escaped, and links to their page", () => {
    const html = claimApprovedEmailHtml("A&B", "a1");
    expect(html).toContain("You now manage <strong>A&amp;B</strong> on Music Nerd.");
    expect(html).toContain('href="https://musicnerd.net/artist/a1"');
  });

  it("degrades to generic copy without a name", () => {
    expect(claimApprovedEmailHtml(null, "a1")).toContain(
      "You now manage your artist profile on Music Nerd.",
    );
  });
});
