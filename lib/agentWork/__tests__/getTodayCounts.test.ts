import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getTodayCounts } from "@/lib/agentWork/getTodayCounts";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getTodayCounts", () => {
  it("maps today's mapping counts by platform", async () => {
    mock.execute.mockResolvedValueOnce([
      { platform: "deezer", today: 11 },
      { platform: "wikidata", today: 1 },
    ]);
    expect(await getTodayCounts()).toEqual({ deezer: 11, wikidata: 1 });
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain(
      "FROM artist_id_mappings WHERE created_at >= CURRENT_DATE GROUP BY platform",
    );
  });

  it("is empty when nothing was mapped today", async () => {
    mock.execute.mockResolvedValueOnce([]);
    expect(await getTodayCounts()).toEqual({});
  });
});
