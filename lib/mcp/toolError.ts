import type { ToolResult } from "@/lib/mcp/types";

/**
 * A tool's failure: `{ error, code }` as compact JSON text, flagged `isError`.
 *
 * @param error - The message.
 * @param code - The code the agent branches on.
 * @returns The MCP error content.
 */
export function toolError(error: string, code: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error, code }) }], isError: true };
}
