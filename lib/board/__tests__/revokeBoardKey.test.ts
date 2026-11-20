import { beforeEach, describe, expect, it, vi } from "vitest";
import { revokeBoardKey } from "@/lib/board/revokeBoardKey";

const mock = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { update: mock.update } }));
vi.mock("@/lib/db/schema", () => ({
  mcpApiKeys: {
    id: { name: "id" },
    keyHash: { name: "key_hash" },
    label: { name: "label" },
    createdAt: { name: "created_at" },
    revokedAt: { name: "revoked_at" },
    boardMember: { name: "board_member" },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mock.update.mockReturnValue({ set: mock.set });
  mock.set.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ returning: mock.returning });
});

describe("revokeBoardKey", () => {
  it("revokes only the member's own working key", async () => {
    mock.returning.mockResolvedValueOnce([{ id: "k1" }]);
    expect(await revokeBoardKey("sweetman", "k1")).toBe(true);
    const where = JSON.stringify(mock.where.mock.calls[0][0]);
    expect(where).toContain("board_member");
    expect(where).toContain("sweetman");
  });

  it("is false when the member has no working key with that id", async () => {
    mock.returning.mockResolvedValueOnce([]);
    expect(await revokeBoardKey("sweetman", "k1")).toBe(false);
  });
});
