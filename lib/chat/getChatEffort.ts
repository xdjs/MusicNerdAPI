/**
 * The chat model's reasoning effort. Legacy is always `low`; in units mode `CHAT_EFFORT` may
 * raise it to `medium` or `high` (trimmed, case-insensitive), and anything else is `low`.
 *
 * @param mode - The chat's retrieval mode.
 * @param env - The environment to read; `process.env` by default.
 * @returns The effort.
 */
export function getChatEffort(
  mode: "units" | "legacy",
  env: Record<string, string | undefined> = process.env,
): "low" | "medium" | "high" {
  if (mode === "legacy") return "low";
  const value = env.CHAT_EFFORT?.trim().toLowerCase();
  return value === "medium" || value === "high" ? value : "low";
}
