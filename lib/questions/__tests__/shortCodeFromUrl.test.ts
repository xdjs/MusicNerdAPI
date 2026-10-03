import { describe, it, expect } from "vitest";
import { shortCodeFromUrl } from "@/lib/questions/shortCodeFromUrl";

describe("shortCodeFromUrl", () => {
  it("keeps the full TikTok/X id instead of truncating similar URLs into the same key", () => {
    expect(
      shortCodeFromUrl("https://www.tiktok.com/@averylongartistusername/video/7420000000000000001"),
    ).toBe("tiktok_7420000000000000001");
    expect(
      shortCodeFromUrl("https://www.tiktok.com/@averylongartistusername/video/7420000000000000002"),
    ).toBe("tiktok_7420000000000000002");
    expect(shortCodeFromUrl("https://x.com/artist/status/7420000000000000001")).toBe(
      "x_7420000000000000001",
    );
  });
  it("reads the Instagram shortcode, falling back to a slug of the url", () => {
    expect(shortCodeFromUrl("https://www.instagram.com/p/DcD2TOMSCtE/")).toBe("DcD2TOMSCtE");
    expect(shortCodeFromUrl("https://www.instagram.com/p/A_b/")).toBe("A_b");
    expect(shortCodeFromUrl("https://x.com/pete")).toBe("https_x_com_pete");
  });
});
