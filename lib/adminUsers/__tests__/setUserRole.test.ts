import { describe, it, expect, vi, beforeEach } from "vitest";
import { setUserRole } from "@/lib/adminUsers/setUserRole";

const mock = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { update: mock.update } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.update.mockReturnValue({ set: mock.set });
  mock.set.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ returning: mock.returning });
  mock.returning.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
});

const changes = () => {
  const { updatedAt, ...rest } = mock.set.mock.calls[0][0] as Record<string, unknown>;
  expect(new Date(String(updatedAt)).toISOString()).toBe(updatedAt);
  return rest;
};

describe("setUserRole", () => {
  it("returns how many users were updated", async () => {
    expect(await setUserRole(["u1", "u2"], "whitelisted", true)).toBe(2);
    expect(changes()).toEqual({ isWhiteListed: true });
  });

  it("whitelists a user made admin", async () => {
    await setUserRole(["u1"], "admin", true);
    expect(changes()).toEqual({ isAdmin: true, isWhiteListed: true });
  });

  it("removes admin without touching the whitelist", async () => {
    await setUserRole(["u1"], "admin", false);
    expect(changes()).toEqual({ isAdmin: false });
  });

  it("hides and unhides", async () => {
    await setUserRole(["u1"], "hidden", false);
    expect(changes()).toEqual({ isHidden: false });
  });
});
