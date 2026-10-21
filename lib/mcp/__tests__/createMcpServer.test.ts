import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const { createMcpServer } = await import("@/lib/mcp/createMcpServer");

describe("createMcpServer", () => {
  it("registers the ten tools in Web's order", () => {
    const server = createMcpServer();
    expect(Object.keys((server as any)._registeredTools)).toEqual([
      "search_artists",
      "get_artist",
      "set_artist_link",
      "delete_artist_link",
      "get_unmapped_artists",
      "get_mapping_stats",
      "get_artist_mappings",
      "resolve_artist_id",
      "exclude_artist_mapping",
      "get_mapping_exclusions",
    ]);
  });

  it("builds a new server each time, so each request gets its own transport", () => {
    expect(createMcpServer()).not.toBe(createMcpServer());
  });
});
