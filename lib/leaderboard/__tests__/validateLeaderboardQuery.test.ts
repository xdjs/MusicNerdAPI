import { describe, expect, it } from "vitest";
import { validateLeaderboardQuery } from "@/lib/leaderboard/validateLeaderboardQuery";

const q = (s: string) => validateLeaderboardQuery(new URLSearchParams(s));

describe("validateLeaderboardQuery", () => {
  it("defaults to the whole list, page 1 of 10", () => {
    expect(q("")).toEqual({ from: null, to: null, page: 1, perPage: 10, isPaginated: false });
  });

  it("paginates when page or perPage is sent, ignoring bad values as MusicNerdWeb did", () => {
    expect(q("page=2&perPage=5")).toMatchObject({ page: 2, perPage: 5, isPaginated: true });
    expect(q("page=abc")).toMatchObject({ page: 1, perPage: 10, isPaginated: true });
    expect(q("perPage=-3")).toMatchObject({ page: 1, perPage: 10, isPaginated: true });
    expect(q("page=2.9")).toMatchObject({ page: 2 });
  });

  it("passes the period through", () => {
    expect(q("from=2026-09-15T00:00:00Z&to=2026-09-15T23:59:59Z")).toMatchObject({
      from: "2026-09-15T00:00:00Z",
      to: "2026-09-15T23:59:59Z",
      isPaginated: false,
    });
  });
});
