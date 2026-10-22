import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getPlatformIdStats } from "@/lib/artistData/getPlatformIdStats";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getPlatformIdStats", () => {
  it("maps each platform's count and today's count", async () => {
    mock.execute.mockResolvedValueOnce([
      { platform: "deezer", count: 58, today_count: 11 },
      { platform: "wikidata", count: 3, today_count: 0 },
    ]);
    const stats = await getPlatformIdStats();
    expect([...stats.entries()]).toEqual([
      ["deezer", { count: 58, todayCount: 11 }],
      ["wikidata", { count: 3, todayCount: 0 }],
    ]);
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("FROM artist_id_mappings GROUP BY platform ORDER BY count DESC");
    expect(text).toContain("created_at >= CURRENT_DATE");
  });
});
