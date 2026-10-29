import { describe, expect, it } from "vitest";
import { validateReviewQueueQuery } from "@/lib/adminReview/validateReviewQueueQuery";

const request = (query: string) =>
  new Request(`https://api.musicnerd.test/api/admin/review-queue${query}`);

describe("validateReviewQueueQuery", () => {
  it("reads type, query and page", () => {
    expect(validateReviewQueueQuery(request("?type=sources&query=%20dutch%20&page=2"))).toEqual({
      type: "sources",
      query: "dutch",
      page: 2,
    });
  });

  it("defaults to every type, no search and page 1", () => {
    expect(validateReviewQueueQuery(request(""))).toEqual({ type: "all", query: "", page: 1 });
  });

  it("treats an unknown type as all and a bad page as 1, as MusicNerdWeb did", () => {
    expect(validateReviewQueueQuery(request("?type=ugc&page=abc"))).toEqual({
      type: "all",
      query: "",
      page: 1,
    });
  });

  it("cuts the search to 100 characters", () => {
    expect(validateReviewQueueQuery(request(`?query=${"a".repeat(150)}`)).query).toHaveLength(100);
  });
});
