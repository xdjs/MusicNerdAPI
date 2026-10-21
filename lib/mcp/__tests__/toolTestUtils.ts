import { McpServer, type RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";

/** A bare server to register one tool on. */
export function testServer(): McpServer {
  return new McpServer({ name: "t", version: "0" });
}

/** Calls a registered tool's handler and parses its text content. */
export async function callTool(tool: RegisteredTool, args: Record<string, unknown>) {
  const result = (await (tool.handler as (a: unknown, e: unknown) => Promise<unknown>)(
    args,
    {},
  )) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  return { result, parsed: JSON.parse(result.content[0].text) };
}
