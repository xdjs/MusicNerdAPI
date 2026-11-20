import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBoardKeys } from "@/lib/board/getBoardKeys";

const mock = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { select: mock.select } }));
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
  mock.select.mockReturnValue({ from: mock.from });
  mock.from.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ orderBy: mock.orderBy });
});

describe("getBoardKeys", () => {
  it("lists the member's working keys with the profile each posts as", async () => {
    mock.orderBy.mockResolvedValueOnce([
      { id: "k1", agent: "claude-duet", createdAt: "2026-11-20 18:04:11+00" },
    ]);
    expect(await getBoardKeys("sweetman")).toEqual([
      {
        id: "k1",
        agent: "claude-duet",
        profile: "claude-duet-sweetman",
        createdAt: "2026-11-20 18:04:11+00",
      },
    ]);
    const where = JSON.stringify(mock.where.mock.calls[0][0]);
    expect(where).toContain("board_member");
    expect(where).toContain("sweetman");
    expect(where).toContain("revoked_at");
  });
});
