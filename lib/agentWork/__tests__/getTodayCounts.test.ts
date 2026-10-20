import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getTodayCounts } = await import("@/lib/agentWork/getTodayCounts");

describe("getTodayCounts", () => {
  it("maps platform to today's count", async () => {
    execute.mockResolvedValueOnce([
      { platform: "deezer", today: 2 },
      { platform: "tidal", today: 5 },
    ]);
    expect(await getTodayCounts()).toEqual({ deezer: 2, tidal: 5 });
  });
});
