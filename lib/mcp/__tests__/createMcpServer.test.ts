import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const { createMcpServer } = await import("@/lib/mcp/createMcpServer");

const READ_TOOLS = [
  "search_artists",
  "get_artist",
  "get_unmapped_artists",
  "get_mapping_stats",
  "get_artist_mappings",
  "get_mapping_exclusions",
];
const WRITE_TOOLS = [
  "set_artist_link",
  "delete_artist_link",
  "resolve_artist_id",
  "exclude_artist_mapping",
];
const context = { userId: "user-1", isAdmin: false, member: null, grantId: "grant-1" };
const toolsOf = (server: unknown) =>
  Object.keys((server as { _registeredTools: object })._registeredTools);

describe("createMcpServer", () => {
  it("gives everyone signed in the read tools only", () => {
    expect(toolsOf(createMcpServer(context))).toEqual(READ_TOOLS);
  });

  it("adds the write tools for an admin", () => {
    expect(toolsOf(createMcpServer({ ...context, isAdmin: true }))).toEqual([
      ...READ_TOOLS,
      ...WRITE_TOOLS,
    ]);
  });

  it("builds a new server each time, so each request gets its own transport", () => {
    expect(createMcpServer(context)).not.toBe(createMcpServer(context));
  });
});
