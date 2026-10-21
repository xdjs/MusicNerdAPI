import { beforeEach, describe, expect, it, vi } from "vitest";

const { all, range } = vi.hoisted(() => ({ all: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/leaderboard/getLeaderboard", () => ({ getLeaderboard: all }));
vi.mock("@/lib/leaderboard/getLeaderboardInRange", () => ({ getLeaderboardInRange: range }));
const { getLeaderboardHandler } = await import("@/lib/leaderboard/getLeaderboardHandler");

const row = (userId: string, ugcCount: number, artistsCount: number) => ({
  userId,
  wallet: null,
  username: userId,
  email: null,
  isHidden: false,
  artistsCount,
  ugcCount,
});
const eligible = [row("ugc-only", 2, 0), row("artist-only", 0, 1)];
const get = (query = "") =>
  getLeaderboardHandler(new Request(`https://api.test/api/leaderboard${query}`));

beforeEach(() => {
  all.mockReset().mockResolvedValue(eligible);
  range.mockReset().mockResolvedValue(eligible);
});

describe("getLeaderboardHandler", () => {
  it("returns the whole list as an array, with CORS", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(eligible);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(all).toHaveBeenCalled();
    expect(range).not.toHaveBeenCalled();
  });

  it("uses the period query only when both bounds are sent", async () => {
    await get("?from=2026-09-15T00:00:00Z");
    expect(range).not.toHaveBeenCalled();
    await get("?from=2026-09-15T00:00:00Z&to=2026-09-15T23:59:59Z");
    expect(range).toHaveBeenCalledWith("2026-09-15T00:00:00Z", "2026-09-15T23:59:59Z");
  });

  it("paginates after the queries' own filtering", async () => {
    for (const page of [1, 2, 3]) {
      const r = await get(`?page=${page}&perPage=1`);
      expect(await r.json()).toEqual({
        entries: eligible.slice(page - 1, page),
        total: 2,
        pageCount: 2,
      });
    }
    all.mockResolvedValueOnce([]);
    expect(await (await get("?page=1")).json()).toEqual({ entries: [], total: 0, pageCount: 0 });
  });

  it.each(["", "?page=1&perPage=10", "?from=2026-09-15T00:00:00Z&to=2026-09-15T23:59:59Z"])(
    "protects pending names and private account fields %s",
    async query => {
      const rows = [
        {
          ...row("email-backed", 1, 0),
          username: "private@example.test",
          email: "private@example.test",
        },
        { ...row("wallet-backed", 1, 0), username: " 0xAbC ", wallet: "0xabc" },
        {
          ...row("chosen", 1, 0),
          username: "Aux Bandit",
          email: "private@example.test",
          wallet: "0xabc",
        },
      ];
      all.mockResolvedValueOnce(rows);
      range.mockResolvedValueOnce(rows);
      const data = await (await get(query)).json();
      const entries = Array.isArray(data) ? data : data.entries;
      expect(entries.map((e: { username: string }) => e.username)).toEqual([
        "Anonymous",
        "Anonymous",
        "Aux Bandit",
      ]);
      expect(
        entries.every((e: { email: null; wallet: null }) => e.email === null && e.wallet === null),
      ).toBe(true);
    },
  );

  it("answers 500 with the error's message as details", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    all.mockRejectedValueOnce(new Error("Error getting leaderboard"));
    const r = await get();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({
      error: "Failed to fetch leaderboard",
      details: "Error getting leaderboard",
    });
    error.mockRestore();
  });
});
