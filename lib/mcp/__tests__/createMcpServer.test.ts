import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const team = vi.hoisted(() => ({ as: vi.fn(() => ({})) }));
vi.mock("@/lib/board/team", () => ({ team }));
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
const BOARD_TOOLS = ["list_channels", "read_channel", "read_thread", "post", "reply"];
const context = {
  userId: "user-1",
  isAdmin: false,
  member: null,
  grantId: "grant-1",
  agent: "Claude",
};
const ORIGIN = "https://api.musicnerd.net";
const toolsOf = (server: unknown) =>
  Object.keys((server as { _registeredTools: object })._registeredTools);

beforeEach(() => vi.clearAllMocks());

describe("createMcpServer", () => {
  it("gives everyone signed in the read tools only", () => {
    expect(toolsOf(createMcpServer(context, ORIGIN))).toEqual(READ_TOOLS);
    expect(team.as).not.toHaveBeenCalled();
  });

  it("adds the write tools for an admin", () => {
    expect(toolsOf(createMcpServer({ ...context, isAdmin: true }, ORIGIN))).toEqual([
      ...READ_TOOLS,
      ...WRITE_TOOLS,
    ]);
  });

  it("adds the board tools for a team member, reading and posting as <agent>-<member>", () => {
    expect(toolsOf(createMcpServer({ ...context, member: "sweetman" }, ORIGIN))).toEqual([
      ...READ_TOOLS,
      ...BOARD_TOOLS,
    ]);
    expect(team.as).toHaveBeenCalledWith("claude-sweetman", { can: ["read", "post"] });
  });

  it("gives an admin on the team both the write and the board tools", () => {
    expect(
      toolsOf(createMcpServer({ ...context, isAdmin: true, member: "sweetman" }, ORIGIN)),
    ).toEqual([...READ_TOOLS, ...WRITE_TOOLS, ...BOARD_TOOLS]);
  });

  it("builds a new server each time, so each request gets its own transport", () => {
    expect(createMcpServer(context, ORIGIN)).not.toBe(createMcpServer(context, ORIGIN));
  });
});
