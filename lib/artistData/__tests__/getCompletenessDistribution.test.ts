import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getCompletenessDistribution } from "@/lib/artistData/getCompletenessDistribution";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getCompletenessDistribution", () => {
  it("buckets the counts with percentages, and reads the median and average once", async () => {
    mock.execute.mockResolvedValueOnce([
      { bucket: "0-1", sort_order: 1, count: 25, median_fields: "5.0", avg_fields: "5.2" },
      { bucket: "2-3", sort_order: 2, count: 75, median_fields: "5.0", avg_fields: "5.2" },
    ]);
    expect(await getCompletenessDistribution()).toEqual({
      buckets: [
        { bucket: "0-1", count: 25, percentage: 25 },
        { bucket: "2-3", count: 75, percentage: 75 },
      ],
      medianFields: 5,
      averageFields: 5.2,
    });
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("WITH field_counts AS");
    expect(text).toContain(
      `CASE WHEN "instagram" IS NOT NULL AND "instagram" != '' THEN 1 ELSE 0 END +`,
    );
    expect(text).toContain(
      "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY field_count)::numeric(5,1)",
    );
    expect(text).toContain("ORDER BY sort_order");
  });

  it("is empty with zero stats when there are no artists", async () => {
    mock.execute.mockResolvedValueOnce([]);
    expect(await getCompletenessDistribution()).toEqual({
      buckets: [],
      medianFields: 0,
      averageFields: 0,
    });
  });
});
