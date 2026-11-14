/**
 * The chat model's reasoning effort. Legacy is always `low`; in units mode `CHAT_EFFORT` may
 * raise it to `medium` (trimmed, case-insensitive), and anything else is `low`. `high` is not
 * offered: the chat's 1,500-token output cap is not sized for it, since reasoning tokens may be
 * spent out of the same budget before the answer is written, so `high` falls back to `low`.
 *
 * @param mode - The chat's retrieval mode.
 * @param env - The environment to read; `process.env` by default.
 * @returns The effort.
 */
export function getChatEffort(
  mode: "units" | "legacy",
  env: Record<string, string | undefined> = process.env,
): "low" | "medium" {
  if (mode === "legacy") return "low";
  const value = env.CHAT_EFFORT?.trim().toLowerCase();
  return value === "medium" ? value : "low";
}
