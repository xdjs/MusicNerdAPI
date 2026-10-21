import { describe, it, expect } from "vitest";
import { isMainWebsiteSource } from "@/lib/musicLinks/isMainWebsiteSource";

describe("isMainWebsiteSource", () => {
  it("accepts a website source with no approved main site above it", () => {
    expect(isMainWebsiteSource({ url: "https://peterango.com", type: "website" })).toBe(true);
  });

  it("refuses a non-website source or an unusable URL", () => {
    expect(isMainWebsiteSource({ url: "https://peterango.com", type: "article" })).toBe(false);
    expect(isMainWebsiteSource({ url: "not a url", type: "website" })).toBe(false);
  });

  it("refuses a page under an approved main site", () => {
    const main = { url: "https://peterango.com", type: "website", status: "approved" };
    expect(
      isMainWebsiteSource({ url: "https://peterango.com/tour", type: "website" }, [main]),
    ).toBe(false);
    expect(
      isMainWebsiteSource({ url: "https://peterango.com/?page=2", type: "website" }, [main]),
    ).toBe(false);
  });

  it("ignores pending, podcast and non-website candidates", () => {
    const page = { url: "https://peterango.com/tour", type: "website" };
    expect(
      isMainWebsiteSource(page, [
        { url: "https://peterango.com", type: "website", status: "pending" },
        { url: "https://peterango.com", type: "website", podcastEpisodeKey: "k" },
        { url: "https://peterango.com", type: "article" },
      ]),
    ).toBe(true);
  });
});
