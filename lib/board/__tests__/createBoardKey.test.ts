import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBoardKey } from "@/lib/board/createBoardKey";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

const mock = vi.hoisted(() => ({ insert: vi.fn(), values: vi.fn(), returning: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { insert: mock.insert } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.insert.mockReturnValue({ values: mock.values });
  mock.values.mockReturnValue({ returning: mock.returning });
  mock.returning.mockResolvedValue([{ id: "k1" }]);
});

describe("createBoardKey", () => {
  it("stores the hash with the agent as label and the member, and returns the key once", async () => {
    const created = await createBoardKey("sweetman", "claude-duet");
    expect(created.id).toBe("k1");
    expect(created.rawKey).toMatch(/^[a-f0-9]{64}$/);
    expect(mock.values).toHaveBeenCalledWith({
      keyHash: hashApiKey(created.rawKey),
      label: "claude-duet",
      boardMember: "sweetman",
    });
  });
});
