/**
 * The chat model's reasoning effort: `CHAT_EFFORT` may raise it to `medium` (trimmed, case-insensitive), and anything else is `low`. `high` is not
 * offered: the chat's 1,500-token output cap is not sized for it, since reasoning tokens may be
 * spent out of the same budget before the answer is written, so `high` falls back to `low`.
 *
 * @param env - The environment to read; `process.env` by default.
 * @returns The effort.
 */
export function getChatEffort(
  env: Record<string, string | undefined> = process.env,
): "low" | "medium" {
  const value = env.CHAT_EFFORT?.trim().toLowerCase();
  return value === "medium" ? value : "low";
}
