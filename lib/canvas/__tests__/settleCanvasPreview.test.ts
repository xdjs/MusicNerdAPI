import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { settleCanvasPreview } from "../settleCanvasPreview";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("MUSICNERD_CANVAS_PREVIEW_ENABLED", "1");
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
  m.execute.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
it("settles known total usage under the same shared lock", async () => {
  await settleCanvasPreview("11111111-1111-4111-8111-111111111111", {
    inputTokens: 20000,
    outputTokens: 1000,
  });
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("retains the full reservation for missing, invalid or out-of-bound usage", async () => {
  for (const usage of [
    {},
    { inputTokens: NaN, outputTokens: 2 },
    { inputTokens: -1, outputTokens: 2 },
    { inputTokens: 200001, outputTokens: 0 },
    { inputTokens: 1, outputTokens: 8193 },
  ])
    await settleCanvasPreview("11111111-1111-4111-8111-111111111111", usage);
  expect(m.transaction).not.toHaveBeenCalled();
});
it("never settles in production", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  await settleCanvasPreview("11111111-1111-4111-8111-111111111111", {
    inputTokens: 2,
    outputTokens: 2,
  });
  expect(m.transaction).not.toHaveBeenCalled();
});
