import { describe, expect, it, vi } from "vitest";
import { getQuestionResearchBudget } from "../getQuestionResearchBudget";
const checked = "2026-10-15T12:00:00.000Z";
const row = {
  checked_at: checked,
  saved_global: 0,
  outside_global: 0,
  outside_artist: 0,
  saved_reset: null,
  global_reset: null,
  artist_reset: null,
};
describe("rolling question budgets", () => {
  it("returns no exhausted allowance from valid zero counts", async () => {
    const store = { execute: vi.fn().mockResolvedValue([row]) };
    expect(await getQuestionResearchBudget(store as never, "artist")).toEqual({
      checkedAt: checked,
      saved: null,
      outside: null,
    });
  });
  it("returns the exact saved global boundary rather than a fixed daily wait", async () => {
    const store = {
      execute: vi
        .fn()
        .mockResolvedValue([
          { ...row, saved_global: 100, saved_reset: "2026-10-15T12:03:20.100Z" },
        ]),
    };
    expect((await getQuestionResearchBudget(store as never, "artist")).saved).toEqual({
      quotaScope: "saved_global",
      resetAt: "2026-10-15T12:03:20.100Z",
      retryAfterSeconds: 201,
    });
  });
  it("waits until both exhausted outside limits allow a reservation", async () => {
    const store = {
      execute: vi.fn().mockResolvedValue([
        {
          ...row,
          outside_global: 100,
          outside_artist: 5,
          global_reset: "2026-10-15T14:00:00Z",
          artist_reset: "2026-10-15T13:00:00Z",
        },
      ]),
    };
    expect((await getQuestionResearchBudget(store as never, "artist")).outside).toEqual({
      quotaScope: "outside_global",
      resetAt: "2026-10-15T14:00:00.000Z",
      retryAfterSeconds: 7200,
    });
  });
  it.each([
    { ...row, saved_global: 100 },
    { ...row, outside_artist: 5, artist_reset: "bad" },
    { ...row, saved_global: -1 },
    { ...row, checked_at: null },
  ])("fails closed for incomplete budget metadata", async invalid => {
    await expect(
      getQuestionResearchBudget(
        { execute: vi.fn().mockResolvedValue([invalid]) } as never,
        "artist",
      ),
    ).rejects.toThrow("Research budget unavailable");
  });
});
