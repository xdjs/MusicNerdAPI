import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { reviewBioCorrection } from "@/lib/bioCorrections/reviewBioCorrection";

const mock = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { update: mock.update } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.update.mockReturnValue({ set: mock.set });
  mock.set.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ returning: mock.returning });
});

describe("reviewBioCorrection", () => {
  it("marks a pending report with the outcome, reviewer and time", async () => {
    mock.returning.mockResolvedValueOnce([{ id: "r1" }]);
    expect(await reviewBioCorrection("r1", "dismissed", "admin")).toBe(true);
    const set = mock.set.mock.calls[0][0] as {
      status: string;
      reviewedAt: string;
      reviewedBy: string;
    };
    expect(set.status).toBe("dismissed");
    expect(set.reviewedBy).toBe("admin");
    expect(new Date(set.reviewedAt).toISOString()).toBe(set.reviewedAt);
    const where = renderSql(mock.where.mock.calls[0][0] as SQL);
    expect(where.params).toEqual(["r1", "pending"]);
  });

  it("is false when the report is not pending or does not exist", async () => {
    mock.returning.mockResolvedValueOnce([]);
    expect(await reviewBioCorrection("r1", "resolved", "admin")).toBe(false);
  });
});
