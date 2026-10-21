import type { ToolResult } from "@/lib/mcp/types";

/**
 * A tool's successful result: the value as pretty-printed JSON text.
 *
 * @param value - What the tool returns.
 * @returns The MCP text content.
 */
export function toolText(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
