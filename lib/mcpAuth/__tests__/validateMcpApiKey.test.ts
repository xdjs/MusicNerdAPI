import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { mcpApiKeys: { findFirst } } } }));
vi.mock("@/lib/db/schema", () => ({
  mcpApiKeys: { keyHash: { name: "key_hash" }, revokedAt: { name: "revoked_at" } },
}));
const { validateMcpApiKey } = await import("@/lib/mcpAuth/validateMcpApiKey");

const req = (auth?: string) =>
  new Request("https://api/mcp", { headers: auth ? { Authorization: auth } : {} });

beforeEach(() => vi.clearAllMocks());

describe("validateMcpApiKey", () => {
  it("returns the key's hash when an unrevoked row has it", async () => {
    const hash = hashApiKey("valid-api-key");
    findFirst.mockResolvedValue({ keyHash: hash, revokedAt: null });
    expect(await validateMcpApiKey(req("Bearer valid-api-key"))).toBe(hash);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("accepts a lowercase bearer scheme", async () => {
    const hash = hashApiKey("valid-api-key");
    findFirst.mockResolvedValue({ keyHash: hash, revokedAt: null });
    expect(await validateMcpApiKey(req("bearer valid-api-key"))).toBe(hash);
  });

  it("looks the hash up, never the raw key, among unrevoked keys", async () => {
    findFirst.mockResolvedValue(undefined);
    await validateMcpApiKey(req("Bearer secret"));
    const where = findFirst.mock.calls[0][0].where;
    const text = JSON.stringify(where);
    expect(text).toContain(hashApiKey("secret"));
    expect(text).not.toContain('"secret"');
    expect(text).toContain("revoked_at");
    expect(text).toContain("is null");
  });

  it("is null without a header, with a non-Bearer header, and never touches the database then", async () => {
    expect(await validateMcpApiKey(req())).toBeNull();
    expect(await validateMcpApiKey(req("Basic abc123"))).toBeNull();
    expect(await validateMcpApiKey(req("Bearer "))).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("is null for an unknown or revoked key", async () => {
    findFirst.mockResolvedValue(undefined);
    expect(await validateMcpApiKey(req("Bearer unknown-key"))).toBeNull();
    expect(await validateMcpApiKey(req("Bearer revoked-key"))).toBeNull();
  });
});
