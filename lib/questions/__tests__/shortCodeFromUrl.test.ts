import { describe, it, expect } from "vitest";
import { shortCodeFromUrl } from "@/lib/questions/shortCodeFromUrl";

describe("shortCodeFromUrl", () => {
  it("reads the Instagram shortcode, falling back to a slug of the url", () => {
    expect(shortCodeFromUrl("https://www.instagram.com/p/DcD2TOMSCtE/")).toBe("DcD2TOMSCtE");
    expect(shortCodeFromUrl("https://www.instagram.com/p/A_b/")).toBe("A_b");
    expect(shortCodeFromUrl("https://x.com/pete")).toBe("https_x_com_pete");
  });
});
