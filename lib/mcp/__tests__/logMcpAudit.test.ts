import { describe, it, expect, vi, beforeEach } from "vitest";

const { insert, values } = vi.hoisted(() => {
  const values = vi.fn(async (_rows: unknown) => []);
  return { values, insert: vi.fn((_table: unknown) => ({ values })) };
});
vi.mock("@/lib/db/db", () => ({ db: { insert } }));
vi.mock("@/lib/db/schema", () => ({ mcpAuditLog: { name: "mcp_audit_log" } }));
const { logMcpAudit } = await import("@/lib/mcp/logMcpAudit");

beforeEach(() => vi.clearAllMocks());

describe("logMcpAudit", () => {
  it("inserts an audit row with every field", async () => {
    await logMcpAudit({
      artistId: "artist-uuid",
      field: "instagram",
      action: "set",
      submittedUrl: "https://instagram.com/test",
      oldValue: "old-user",
      newValue: "test",
      apiKeyHash: "hash-123",
    });
    expect(insert).toHaveBeenCalledWith({ name: "mcp_audit_log" });
    expect(values).toHaveBeenCalledWith([
      {
        artistId: "artist-uuid",
        field: "instagram",
        action: "set",
        submittedUrl: "https://instagram.com/test",
        oldValue: "old-user",
        newValue: "test",
        apiKeyHash: "hash-123",
      },
    ]);
  });

  it("nulls the omitted fields", async () => {
    await logMcpAudit({
      artistId: "artist-uuid",
      field: "x",
      action: "delete",
      oldValue: "old-handle",
      apiKeyHash: "hash-456",
    });
    expect(values).toHaveBeenCalledWith([
      {
        artistId: "artist-uuid",
        field: "x",
        action: "delete",
        submittedUrl: null,
        oldValue: "old-handle",
        newValue: null,
        apiKeyHash: "hash-456",
      },
    ]);
  });

  it("writes a batch in one insert and nothing for an empty batch", async () => {
    await logMcpAudit([
      {
        artistId: "a1",
        field: "mapping:deezer",
        action: "resolve",
        oldValue: null,
        newValue: "1",
        apiKeyHash: "h",
      },
      {
        artistId: "a2",
        field: "mapping:deezer",
        action: "exclude",
        newValue: "conflict",
        apiKeyHash: "h",
      },
    ]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values.mock.calls[0][0]).toHaveLength(2);
    await logMcpAudit([]);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
