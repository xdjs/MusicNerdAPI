import type { WebSearchLogFields } from "@/lib/search/types";

/**
 * The one line `webSearch` logs per call, so a run's log reads "N searches, M
 * results" (#1329 row 2c). It carries the query's length, never its text.
 *
 * @param fields - The call's provider, query, domain count, result count, time and failure.
 * @returns The log line.
 */
export function formatWebSearchLog({
  provider,
  query,
  domains,
  results,
  ms,
  error,
}: WebSearchLogFields): string {
  return `[websearch] ${provider} q=${query.length} domains=${domains} results=${results} ${ms}ms${error ? ` error=${error}` : ""}`;
}
