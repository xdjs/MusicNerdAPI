import { describe, it, expect } from "vitest";
import { soundcloudFallback } from "@/lib/artists/soundcloudFallback";
import { urlmapRows } from "@/lib/artists/__tests__/urlmapRows";

const rows = [
  { ...urlmapRows.find(r => r.siteName === "soundcloud")!, appStringFormat: "", regex: "" },
];

describe("soundcloudFallback", () => {
  it("reads the first path segment of a soundcloud.com URL", () => {
    expect(soundcloudFallback("soundcloud.com/peterango/x", rows)).toEqual({
      siteName: "soundcloud",
      cardPlatformName: "Soundcloud",
      id: "peterango",
    });
  });

  it("rejects user-id and numeric segments, other hosts, and a missing urlmap row", () => {
    expect(soundcloudFallback("soundcloud.com/user-123", rows)).toBeNull();
    expect(soundcloudFallback("soundcloud.com/123", rows)).toBeNull();
    expect(soundcloudFallback("https://example.com/a", rows)).toBeNull();
    expect(soundcloudFallback("soundcloud.com/peterango", [])).toBeNull();
  });
});
