import { describe, it, expect, vi, beforeEach } from "vitest";
import { revokeMcpKey } from "@/lib/mcpKeys/revokeMcpKey";

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
});

describe("revokeMcpKey", () => {
  it("sets revokedAt on an active key and reports it", async () => {
    mock.returning.mockResolvedValueOnce([{ id: "k1" }]);
    expect(await revokeMcpKey("k1")).toBe(true);
    const set = mock.set.mock.calls[0][0] as { revokedAt: string };
    expect(new Date(set.revokedAt).toISOString()).toBe(set.revokedAt);
  });

  it("is false when the key is unknown or already revoked", async () => {
    mock.returning.mockResolvedValueOnce([]);
    expect(await revokeMcpKey("k1")).toBe(false);
  });
});
