import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";
import { createMcpKey } from "@/lib/mcpKeys/createMcpKey";

const mock = vi.hoisted(() => ({ values: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { insert: mock.insert } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.insert.mockReturnValue({ values: mock.values });
  mock.values.mockResolvedValue(undefined);
});

describe("createMcpKey", () => {
  it("stores only the SHA-256 of a 32-byte hex key and returns the key once", async () => {
    const created = await createMcpKey("mapping-worker");
    expect(created.label).toBe("mapping-worker");
    expect(created.rawKey).toMatch(/^[a-f0-9]{64}$/);
    expect(mock.values).toHaveBeenCalledWith({
      keyHash: hashApiKey(created.rawKey),
      label: "mapping-worker",
    });
    expect(mock.values.mock.calls[0][0].keyHash).not.toBe(created.rawKey);
  });

  it("generates a different key each time", async () => {
    const a = await createMcpKey("a");
    const b = await createMcpKey("b");
    expect(a.rawKey).not.toBe(b.rawKey);
  });
});
