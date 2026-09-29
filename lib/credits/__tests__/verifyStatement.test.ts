import { describe, it, expect } from "vitest";
import { verifyStatement } from "@/lib/credits/verifyStatement";
import { OTHER_URL, POST_URL, post } from "@/lib/credits/__tests__/post";

const byUrl = new Map([[POST_URL, post()]]);

describe("verifyStatement", () => {
  it("keeps a quote that is in the caption, trimmed", () => {
    expect(
      verifyStatement({ quote: " Enjoy 💚 ", topic: " release day ", url: POST_URL }, byUrl),
    ).toEqual({
      quote: "Enjoy 💚",
      topic: "release day",
      url: POST_URL,
    });
  });

  it("drops a paraphrase, a missing topic and a post it was never given", () => {
    expect(
      verifyStatement({ quote: "He hopes listeners enjoy it", topic: "t", url: POST_URL }, byUrl),
    ).toBeNull();
    expect(verifyStatement({ quote: "Enjoy 💚", topic: "", url: POST_URL }, byUrl)).toBeNull();
    expect(verifyStatement({ quote: "Enjoy 💚", topic: "t", url: OTHER_URL }, byUrl)).toBeNull();
  });
});
