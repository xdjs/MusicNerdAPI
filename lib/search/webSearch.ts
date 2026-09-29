import { DEFAULT_MAX_RESULTS } from "@/lib/search/const";
import { finishWebSearch } from "@/lib/search/finishWebSearch";
import { tavilySearch } from "@/lib/search/tavilySearch";
import type { ProviderOutcome, WebSearchOptions, WebSearchResult } from "@/lib/search/types";

/** Latched so the missing-key warning is said once per process, not once per parallel call. */
let warnedNoKey = false;

/**
 * Searches the web through Tavily. A search API retrieves; it cannot invent a
 * URL the way a model asked to type one does. Best-effort by default: no key,
 * a network, HTTP or parse failure all degrade to [], unless `throwOnError`.
 *
 * @param query - The query.
 * @param opts - Domains, result count, and whether to throw on failure.
 * @returns The results.
 */
export async function webSearch(
  query: string,
  opts?: WebSearchOptions,
): Promise<WebSearchResult[]> {
  const ctx = {
    query,
    domains: opts?.includeDomains?.length ?? 0,
    started: Date.now(),
    throwOnError: opts?.throwOnError === true,
  };
  const apiKey = process.env.TAVILY_API_KEY ?? "";
  if (!apiKey) {
    // No key means no sources, no Lore and no About, with nothing else in the logs to say so.
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn(
        "[webSearch] No TAVILY_API_KEY — web search is OFF. Discovery loses its last-resort tier and the vault finds no sources.",
      );
    }
    return finishWebSearch({ results: [], error: "no_key" }, ctx);
  }

  let outcome: ProviderOutcome;
  try {
    outcome = await tavilySearch(
      query,
      {
        includeDomains: opts?.includeDomains ?? [],
        maxResults: opts?.maxResults ?? DEFAULT_MAX_RESULTS,
      },
      apiKey,
    );
  } catch (e) {
    console.error(`[webSearch] provider "tavily" failed for query "${query}":`, e);
    outcome = { results: [], error: "threw" };
  }
  return finishWebSearch(outcome, ctx);
}
