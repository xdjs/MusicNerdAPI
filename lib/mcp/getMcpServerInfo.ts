import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { MCP_SERVER_INFO } from "@/lib/mcp/const";

/**
 * The MCP server's identity, as `initialize` reports it, with the Music Nerd
 * disc as its icon so clients can show it in their connector lists. The icon
 * is served from `public/` on the same origin, so a preview points at its own.
 *
 * @param origin - The request's origin, like `https://api.musicnerd.net`.
 * @returns The server info.
 */
export function getMcpServerInfo(origin: string): Implementation {
  return {
    ...MCP_SERVER_INFO,
    icons: [{ src: `${origin}/icon.png`, mimeType: "image/png", sizes: ["512x512"] }],
  };
}
