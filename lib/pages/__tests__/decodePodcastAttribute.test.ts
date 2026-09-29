import { describe, it, expect } from "vitest";
import { decodePodcastAttribute } from "@/lib/pages/decodePodcastAttribute";

describe("decodePodcastAttribute", () => {
  it("decodes the few entities podcast pages use, trimmed", () => {
    expect(decodePodcastAttribute(" Tom &amp; Jerry&#39;s &apos;x&apos; &quot;y&quot; ")).toBe(
      "Tom & Jerry's 'x' \"y\"",
    );
  });
});
