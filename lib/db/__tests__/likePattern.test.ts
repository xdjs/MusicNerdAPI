import { describe, expect, it } from "vitest";
import { likePattern } from "@/lib/db/likePattern";

describe("likePattern", () => {
  it("wraps the search in wildcards", () => {
    expect(likePattern("dutch")).toBe("%dutch%");
  });

  it("escapes LIKE's own wildcards and the escape character", () => {
    expect(likePattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });
});
