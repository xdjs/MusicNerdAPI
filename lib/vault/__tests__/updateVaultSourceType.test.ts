import { sql } from "drizzle-orm";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { write, returning, set } = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  return { write: vi.fn(), returning, set };
});
const tx = { update: vi.fn(() => ({ set })) };
vi.mock("@/lib/vault/withVaultSourceWrite", () => ({ withVaultSourceWrite: write }));
const { updateVaultSourceType } = await import("@/lib/vault/updateVaultSourceType");

beforeEach(() => {
  vi.clearAllMocks();
  write.mockImplementation(async (_id, fn) => fn(tx, sql`true`));
});

describe("updateVaultSourceType", () => {
  it("sets the type and returns the updated source", async () => {
    returning.mockResolvedValueOnce([{ id: "s1", type: "interview" }]);
    expect(await updateVaultSourceType("s1", "interview")).toEqual({ id: "s1", type: "interview" });
    expect(write.mock.calls[0][0]).toBe("s1");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ type: "interview" }));
  });

  it("is undefined when nothing matched", async () => {
    returning.mockResolvedValueOnce([]);
    expect(await updateVaultSourceType("s1", "review")).toBeUndefined();
  });
});
