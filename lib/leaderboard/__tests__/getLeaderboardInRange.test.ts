import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (q: SQL) => execute(q) } }));
const { getLeaderboardInRange } = await import("@/lib/leaderboard/getLeaderboardInRange");

const render = (q: SQL) => new PgDialect().sqlToQuery(q);
const row = (userId: string, ugcCount: number, artistsCount: number, isHidden = false) => ({
  userId,
  wallet: userId,
  username: userId,
  email: null,
  ugcCount,
  artistsCount,
  isHidden,
});

beforeEach(() => vi.clearAllMocks());

describe("getLeaderboardInRange", () => {
  const query = () => getLeaderboardInRange("2026-09-15T00:00:00Z", "2026-09-15T23:59:59Z");

  it("drops inactive accounts and keeps single-type contributions and hidden accounts", async () => {
    const eligible = [
      row("ugc-only", 2, 0),
      row("artist-only", 0, 1),
      row("hidden-active", 1, 0, true),
    ];
    execute.mockResolvedValueOnce([
      ...eligible,
      row("never-active", 0, 0),
      row("hidden-inactive", 0, 0, true),
    ]);
    expect(await query()).toEqual(eligible);
  });

  it("returns an empty list when every count is zero", async () => {
    execute.mockResolvedValueOnce([row("never-active", 0, 0)]);
    expect(await query()).toEqual([]);
  });

  it("keeps a numeric-string count, as the all-time COUNT(*) arrives", async () => {
    execute.mockResolvedValueOnce([{ ...row("strings", 0, 0), ugcCount: "3", artistsCount: "0" }]);
    expect(await query()).toEqual([{ ...row("strings", 0, 0), ugcCount: "3", artistsCount: "0" }]);
  });

  it("binds the period to both counts", async () => {
    execute.mockResolvedValueOnce([]);
    await query();
    const { sql, params } = render(execute.mock.calls[0][0]);
    expect(params.filter(p => p === "2026-09-15T00:00:00Z")).toHaveLength(6);
    expect(sql).toContain("a.created_at BETWEEN $1 AND $2");
    expect(sql).toContain("SELECT COUNT(*)::int FROM ugcresearch ug");
  });

  it("wraps a database error in MusicNerdWeb's message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValueOnce(new Error("pool"));
    await expect(query()).rejects.toThrow("Error getting leaderboard in range");
    error.mockRestore();
  });
});
