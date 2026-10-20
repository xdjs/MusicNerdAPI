import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getCompletenessDistribution } =
  await import("@/lib/artistData/getCompletenessDistribution");

describe("getCompletenessDistribution", () => {
  it("computes bucket shares and reads the median and mean", async () => {
    execute.mockResolvedValueOnce([
      { bucket: "0-1", sort_order: 1, count: 3, median_fields: "2.0", avg_fields: "2.5" },
      { bucket: "2-3", sort_order: 2, count: 1, median_fields: "2.0", avg_fields: "2.5" },
    ]);
    expect(await getCompletenessDistribution()).toEqual({
      buckets: [
        { bucket: "0-1", count: 3, percentage: 75 },
        { bucket: "2-3", count: 1, percentage: 25 },
      ],
      medianFields: 2,
      averageFields: 2.5,
    });
  });

  it("is empty with no artists", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await getCompletenessDistribution()).toEqual({
      buckets: [],
      medianFields: 0,
      averageFields: 0,
    });
  });
});
