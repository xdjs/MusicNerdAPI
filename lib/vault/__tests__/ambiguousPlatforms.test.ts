import { describe, it, expect } from "vitest";
import { ambiguousPlatforms } from "@/lib/vault/ambiguousPlatforms";

describe("ambiguousPlatforms", () => {
  it("names the platforms a page gives more than one handle for", () => {
    const resolved = [
      { siteName: "instagram", id: "artist" },
      { siteName: "instagram", id: "label" },
      { siteName: "x", id: "artist" },
      { siteName: "x", id: "artist" },
    ];
    expect([...ambiguousPlatforms(resolved)]).toEqual(["instagram"]);
  });
});
