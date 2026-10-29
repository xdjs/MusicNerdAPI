import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { reserveCanvasPreview } from "../reserveCanvasPreview";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("MUSICNERD_CANVAS_PREVIEW_ENABLED", "1");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T04:00:00Z"));
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("serializes the shared count and permits the eighteenth reservation", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ micros: 17000000 }])
    .mockResolvedValueOnce([{ id: "reservation" }]);
  expect(await reserveCanvasPreview("artist")).toBe("reservation");
  expect(m.execute).toHaveBeenCalledTimes(3);
});
it("fails closed at the cap and never inserts", async () => {
  m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ micros: 18000000 }]);
  await expect(reserveCanvasPreview("artist")).rejects.toThrow("exhausted");
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("never accesses a production database or expired window", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  await expect(reserveCanvasPreview("artist")).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.mocked(Date.now).mockReturnValue(Date.parse("2026-10-30T00:00:00Z"));
  await expect(reserveCanvasPreview("artist")).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
});
