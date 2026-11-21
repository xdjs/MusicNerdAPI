import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBoardTools } from "@/lib/board/registerBoardTools";

type Tool = (args: Record<string, unknown>) => Promise<{
  content: { text: string }[];
  isError?: boolean;
}>;
const tools = new Map<string, Tool>();
const server = {
  registerTool: (name: string, _config: unknown, tool: Tool) => tools.set(name, tool),
} as unknown as McpServer;
const board = {
  channels: vi.fn(),
  threads: vi.fn(),
  thread: vi.fn(),
  post: vi.fn(),
  reply: vi.fn(),
};
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await tools.get(name)!(args);
  return { ...result, value: JSON.parse(result.content[0].text) };
};

beforeEach(() => {
  vi.clearAllMocks();
  tools.clear();
  registerBoardTools(server, board as never);
});

describe("registerBoardTools", () => {
  it("registers the five tools", () => {
    expect([...tools.keys()]).toEqual([
      "list_channels",
      "read_channel",
      "read_thread",
      "post",
      "reply",
    ]);
  });

  it("lists channel paths", async () => {
    board.channels.mockResolvedValueOnce({
      channels: [{ path: "general" }, { path: "code-review" }],
    });
    expect((await call("list_channels")).value).toEqual(["general", "code-review"]);
  });

  it("reads a channel, 20 threads unless told otherwise", async () => {
    board.threads.mockResolvedValue({ threads: [] });
    await call("read_channel", { channel: "general" });
    await call("read_channel", { channel: "general", limit: 5 });
    expect(board.threads.mock.calls).toEqual([
      [{ channel: "general", limit: 20 }],
      [{ channel: "general", limit: 5 }],
    ]);
  });

  it("reads a thread, posts and replies through the board", async () => {
    board.thread.mockResolvedValueOnce({ message: { id: "m1" } });
    board.post.mockResolvedValueOnce({ id: "m2" });
    board.reply.mockResolvedValueOnce({ id: "m3" });
    expect((await call("read_thread", { id: "m1" })).value).toEqual({ message: { id: "m1" } });
    expect((await call("post", { channel: "general", text: "hi" })).value).toEqual({ id: "m2" });
    expect((await call("reply", { id: "m1", text: "ok" })).value).toEqual({ id: "m3" });
    expect(board.post).toHaveBeenCalledWith("general", "hi");
    expect(board.reply).toHaveBeenCalledWith("m1", "ok");
  });

  it("returns a board failure as a tool error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    board.thread.mockRejectedValueOnce(new Error("not_found"));
    const result = await call("read_thread", { id: "nope" });
    expect(result.isError).toBe(true);
    expect(result.value).toEqual({ error: "not_found", code: "BOARD_ERROR" });
  });
});
