import { beforeEach, it, expect, vi } from "vitest";
import { withAdminProfileWrite } from "../withAdminProfileWrite";
const m = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: m.lock }));
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(async cb => cb({ execute: m.execute }));
});
it("rechecks current admin under the artist and role locks", async () => {
  m.execute.mockResolvedValue([{ is_admin: true }]);
  const write = vi.fn().mockResolvedValue("saved");
  expect(await withAdminProfileWrite("artist", "user", write)).toBe("saved");
  expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.execute.mock.invocationCallOrder[0]);
  expect(m.execute.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[0]);
});
it.each([{ rows: [] }, { rows: [{ is_admin: false, is_white_listed: true }] }])(
  "does not grant profile editing after admin loss or from whitelist alone",
  async ({ rows }) => {
    m.execute.mockResolvedValue(rows);
    const write = vi.fn();
    await expect(withAdminProfileWrite("artist", "user", write)).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  },
);
