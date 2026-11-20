import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findBoardKey } from "@/lib/board/findBoardKey";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { mcpApiKeys: { findFirst } } } }));
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
  vi.stubEnv("BOARD_ALLOWED_EMAILS", "sweetman=a@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("findBoardKey", () => {
  it("names the profile of a working board key", async () => {
    findFirst.mockResolvedValueOnce({ label: "claude-duet", boardMember: "sweetman" });
    expect(await findBoardKey("raw")).toBe("claude-duet-sweetman");
    const where = JSON.stringify(findFirst.mock.calls[0][0].where);
    expect(where).toContain(hashApiKey("raw"));
    expect(where).not.toContain('"raw"');
    expect(where).toContain("revoked_at");
    expect(where).toContain("board_member");
  });

  it("is null for an unknown, revoked or admin key", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    expect(await findBoardKey("raw")).toBeNull();
  });

  it("is null once the key's member has left the team", async () => {
    findFirst.mockResolvedValueOnce({ label: "claude-duet", boardMember: "pete" });
    expect(await findBoardKey("raw")).toBeNull();
  });
});
