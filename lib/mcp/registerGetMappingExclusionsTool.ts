import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { getMappingExclusions } from "@/lib/mcp/getMappingExclusions";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

/**
 * Registers `get_mapping_exclusions`: the artists excluded from mapping for a platform.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerGetMappingExclusionsTool(server: McpServer) {
  return server.registerTool(
    "get_mapping_exclusions",
    {
      title: "Get Mapping Exclusions",
      description:
        "List artists that have been excluded from mapping for a given platform. Useful for reviewing skipped artists. Clearing exclusions requires direct database access.",
      inputSchema: {
        platform: z
          .string()
          .describe(`The target platform (e.g. ${[...VALID_MAPPING_PLATFORMS].join(", ")})`),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .default(100)
          .describe("Maximum number of results to return (default 100, max 500)"),
      },
    },
    async ({ platform, limit }) => {
      console.log(
        `[MCP] get_mapping_exclusions called with platform="${platform}", limit=${limit}`,
      );

      try {
        const result = await getMappingExclusions(platform, limit);
        return toolText({ platform, exclusions: result.exclusions, total: result.total });
      } catch (error) {
        if (error instanceof MappingValidationError) {
          return toolError(error.message, "INVALID_INPUT");
        }
        console.error("[MCP] get_mapping_exclusions error:", error);
        return toolError("Failed to get mapping exclusions", "INTERNAL_ERROR");
      }
    },
  );
}
