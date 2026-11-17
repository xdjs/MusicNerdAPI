/**
 * Which retrieval the artist chat uses: `units` (page-level passages, `searchPassages` and
 * `readUnits`) only when `CHAT_RETRIEVAL=units`; otherwise `legacy` (whole stored sources and the
 * PDF tools), the default until the units path replaces it.
 *
 * @param env - The environment to read; `process.env` by default.
 * @returns The mode.
 */
export function getChatRetrievalMode(
  env: Record<string, string | undefined> = process.env,
): "units" | "legacy" {
  return env.CHAT_RETRIEVAL === "units" ? "units" : "legacy";
}
