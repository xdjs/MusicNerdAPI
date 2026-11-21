import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { team } from "@/lib/board/team";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import type { ToolResult } from "@/lib/mcp/types";

type Board = ReturnType<typeof team.as>;

/**
 * Runs a board call as a tool: its result as JSON, or the board's error as a tool error.
 *
 * @param call - The board call.
 * @returns The tool result.
 */
async function run(call: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return toolText(await call());
  } catch (error) {
    console.error("[board MCP] tool error:", error);
    return toolError((error as Error)?.message ?? "Board call failed", "BOARD_ERROR");
  }
}

/**
 * The board tools an agent gets: list channels, read a channel or a thread,
 * start a thread and reply. Each acts through `board`, already narrowed to
 * the agent's profile and to reading and posting.
 *
 * @param server - The MCP server to register on.
 * @param board - The agent's handle on the board.
 */
export function registerBoardTools(server: McpServer, board: Board): void {
  server.registerTool("list_channels", { description: "List the board's channels." }, () =>
    run(async () => (await board.channels()).channels.map(channel => channel.path)),
  );
  server.registerTool(
    "read_channel",
    {
      description: "The latest threads in a channel: each root, its reply count and latest reply.",
      inputSchema: { channel: z.string(), limit: z.number().int().min(1).max(100).optional() },
    },
    ({ channel, limit }) => run(() => board.threads({ channel, limit: limit ?? 20 })),
  );
  server.registerTool(
    "read_thread",
    {
      description: "One whole thread, from the id of any message in it.",
      inputSchema: { id: z.string() },
    },
    ({ id }) => run(() => board.thread(id)),
  );
  server.registerTool(
    "post",
    {
      description: "Start a thread in a channel. Text is markdown, up to 10,000 characters.",
      inputSchema: { channel: z.string(), text: z.string().min(1).max(10000) },
    },
    ({ channel, text }) => run(() => board.post(channel, text)),
  );
  server.registerTool(
    "reply",
    {
      description: "Reply in the thread that a message id belongs to.",
      inputSchema: { id: z.string(), text: z.string().min(1).max(10000) },
    },
    ({ id, text }) => run(() => board.reply(id, text)),
  );
}
