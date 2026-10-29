import { beforeEach, expect, it, vi } from "vitest";
import { readCanvasPreviewBudget } from "../readCanvasPreviewBudget";
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
beforeEach(() => execute.mockReset());
it("reports conservative headroom without inserting or reserving", async () => {
  execute.mockResolvedValue([{ micros: 10678153 }]);
  const result = await readCanvasPreviewBudget();
  expect(result?.remainingUsd).toBeCloseTo(7.321847);
  expect(result?.expiresAt).toBe("2026-10-29T16:00:00Z");
  expect(execute).toHaveBeenCalledTimes(1);
});
it("does not report capacity from an invalid ledger", async () => {
  execute.mockResolvedValue([{ micros: "invalid" }]);
  expect(await readCanvasPreviewBudget()).toBeNull();
});
