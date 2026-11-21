/** The one scope: use the MCP server's tools. */
export const MCP_SCOPE = "mcp:tools";

/** Authorization codes are valid for 60 seconds, and once. */
export const CODE_TTL_SECONDS = 60;

/** Access tokens last five minutes; refresh tokens rotate and last until the member disconnects. */
export const ACCESS_TOKEN_TTL_SECONDS = 300;

/** What an `oauth_tokens` row holds, with the prefix that lets secret scanners spot a leaked token. */
export const TOKEN_PREFIXES = {
  code: "mn_code_",
  access: "mn_at_",
  refresh: "mn_rt_",
} as const;

/** Client and grant ids are UUIDs; anything else is unknown without asking the database. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
