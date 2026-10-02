import { describe, it, expect } from "vitest";
import { isReservedBandcampSubdomain } from "@/lib/discovery/isReservedBandcampSubdomain";

describe("isReservedBandcampSubdomain", () => {
  it("flags Bandcamp's own editorial subdomains, not artists'", () => {
    expect(isReservedBandcampSubdomain("https://blog.bandcamp.com")).toBe(true);
    expect(isReservedBandcampSubdomain("https://peterango.bandcamp.com")).toBe(false);
    expect(isReservedBandcampSubdomain("nope")).toBe(false);
  });
});
