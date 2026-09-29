import { describe, it, expect } from "vitest";
import { podcastService } from "@/lib/sources/podcastService";

describe("podcastService", () => {
  it("names a recognised episode URL's service", () => {
    expect(podcastService("https://podcasts.apple.com/us/podcast/x/id1?i=100")).toBe(
      "Apple Podcasts",
    );
    expect(podcastService("https://www.iheart.com/podcast/x/episode/y-1/")).toBe("iHeart");
    expect(podcastService("https://iheart.com/podcast/x/episode/y-1/")).toBe("iHeart");
  });

  it("is null for a show page, another host or a bad URL", () => {
    expect(podcastService("https://podcasts.apple.com/us/podcast/x/id1")).toBeNull();
    expect(podcastService("https://www.iheart.com/podcast/x/")).toBeNull();
    expect(podcastService("https://example.com/episode/1")).toBeNull();
    expect(podcastService("not a url")).toBeNull();
  });
});
