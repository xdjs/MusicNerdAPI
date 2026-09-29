import { describe, it, expect } from "vitest";
import { toResearchJob } from "@/lib/research/toResearchJob";

describe("toResearchJob", () => {
  it("maps snake_case columns and defaults the optional ones", () => {
    expect(
      toResearchJob({ id: "j", artist_id: "a", kind: "social_ingest", status: "pending" }),
    ).toEqual({
      id: "j",
      artistId: "a",
      kind: "social_ingest",
      status: "pending",
      cursor: 0,
      total: null,
      attempts: 0,
      state: {},
      updatedAt: null,
    });
  });
});
