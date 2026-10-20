import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getActivityPulse } = await import("@/lib/agentWork/getActivityPulse");

describe("getActivityPulse", () => {
  it("reads the last write and hourly rate", async () => {
    execute.mockResolvedValueOnce([{ last_write_at: "t", rate_last_hour: 4 }]);
    expect(await getActivityPulse()).toEqual({ lastWriteAt: "t", rateLastHour: 4 });
  });

  it("defaults with no rows", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await getActivityPulse()).toEqual({ lastWriteAt: null, rateLastHour: 0 });
  });
});
