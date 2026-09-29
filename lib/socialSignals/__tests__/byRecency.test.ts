import { describe, it, expect } from "vitest";
import { byRecency } from "@/lib/socialSignals/byRecency";
import { post } from "@/lib/socialSignals/__tests__/post";

describe("byRecency", () => {
  it("orders newest first and undated last", () => {
    const posts = [
      post({ platformPostId: "old", postedAt: "2020-01-01T00:00:00Z" }),
      post({ platformPostId: "none", postedAt: "" }),
      post({ platformPostId: "new", postedAt: "2026-01-01T00:00:00Z" }),
    ];
    expect([...posts].sort(byRecency).map(p => p.platformPostId)).toEqual(["new", "old", "none"]);
  });
});
