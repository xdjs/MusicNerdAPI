import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";
import { countPendingUGC } from "@/lib/ugc/countPendingUGC";

const mock = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn(), where: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { select: mock.select } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.select.mockReturnValue({ from: mock.from });
  mock.from.mockReturnValue({ where: mock.where });
});

describe("countPendingUGC", () => {
  it("counts rows not accepted and not yet processed, MusicNerdWeb's predicate", async () => {
    mock.where.mockResolvedValueOnce([{ count: 3 }]);
    expect(await countPendingUGC()).toBe(3);
    const where = renderSql(mock.where.mock.calls[0][0] as SQL);
    expect(where.text).toMatch(/"ugcresearch"\."accepted" = \$1/);
    expect(where.text).toMatch(/"ugcresearch"\."date_processed" is null/);
    expect(where.params).toEqual([false]);
  });

  it("is 0 when the count is missing", async () => {
    mock.where.mockResolvedValueOnce([]);
    expect(await countPendingUGC()).toBe(0);
  });
});
