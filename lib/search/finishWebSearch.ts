import { WEB_SEARCH_PROVIDER } from "@/lib/search/const";
import { formatWebSearchLog } from "@/lib/search/formatWebSearchLog";
import type { ProviderOutcome, WebSearchResult } from "@/lib/search/types";

/**
 * Ends one `webSearch` call: logs its `[websearch]` line, success or not
 * (#1329 row 2c), and turns a failure into an error when the caller asked.
 *
 * @param outcome - What the provider returned.
 * @param ctx - The call.
 * @param ctx.query - The query.
 * @param ctx.domains - How many domains it was restricted to.
 * @param ctx.started - When it started, in epoch ms.
 * @param ctx.throwOnError - Throw on failure instead of returning [].
 * @returns The rows.
 */
export function finishWebSearch(
  { results, error }: ProviderOutcome,
  ctx: { query: string; domains: number; started: number; throwOnError: boolean },
): WebSearchResult[] {
  console.log(
    formatWebSearchLog({
      provider: WEB_SEARCH_PROVIDER,
      query: ctx.query,
      domains: ctx.domains,
      results: results.length,
      ms: Date.now() - ctx.started,
      error,
    }),
  );
  if (error && ctx.throwOnError)
    throw new Error(`Web search failed (${WEB_SEARCH_PROVIDER}: ${error})`);
  return results;
}
