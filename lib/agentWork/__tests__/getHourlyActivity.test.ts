import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getHourlyActivity } = await import("@/lib/agentWork/getHourlyActivity");

describe("getHourlyActivity", () => {
  it("maps each hour's counts", async () => {
    execute.mockResolvedValueOnce([{ hour: "h1", resolve_count: 3, exclude_count: 1 }]);
    expect(await getHourlyActivity()).toEqual([{ hour: "h1", resolveCount: 3, excludeCount: 1 }]);
  });
});
