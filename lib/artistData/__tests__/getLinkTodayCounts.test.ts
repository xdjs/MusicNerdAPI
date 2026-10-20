import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getLinkTodayCounts } = await import("@/lib/artistData/getLinkTodayCounts");

describe("getLinkTodayCounts", () => {
  it("maps column to today's artist count", async () => {
    execute.mockResolvedValueOnce([{ field: "instagram", today: 3 }]);
    expect([...(await getLinkTodayCounts())]).toEqual([["instagram", 3]]);
  });
});
