import { REQUEST_TIMEOUT_MS, TAVILY_ENDPOINT } from "@/lib/search/const";
import type {
  ProviderOutcome,
  ResolvedWebSearchOptions,
  WebSearchResult,
} from "@/lib/search/types";
import { fetchWithTimeout } from "@/lib/networking/fetchWithTimeout";

/**
 * One Tavily search: `POST /search` with a Bearer key and snake_case fields;
 * Tavily's `content` becomes `snippet` here. Every failure is logged: a rate
 * limit, an expired key or a spent plan otherwise reads exactly like "the web
 * has nothing about this artist".
 *
 * @param query - The query.
 * @param opts - Domains and result count.
 * @param apiKey - `TAVILY_API_KEY`.
 * @returns The rows, and on failure the kind of failure with no rows.
 */
export async function tavilySearch(
  query: string,
  opts: ResolvedWebSearchOptions,
  apiKey: string,
): Promise<ProviderOutcome> {
  const res = await fetchWithTimeout(
    TAVILY_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query,
        include_domains: opts.includeDomains,
        max_results: opts.maxResults,
      }),
    },
    REQUEST_TIMEOUT_MS,
  );
  if (!res) {
    console.error(
      `[webSearch] Tavily did not respond (timeout or network) for: ${query.slice(0, 80)}`,
    );
    return { results: [], error: "no_response" };
  }
  if (!res.ok) {
    // The body carries Tavily's reason: 401 bad key, 429 rate limit, 432 plan exhausted.
    const detail = await res.text().catch(() => "");
    console.error(
      `[webSearch] Tavily HTTP ${res.status} for "${query.slice(0, 60)}": ${detail.slice(0, 200)}`,
    );
    return { results: [], error: `http_${res.status}` };
  }

  let body: { results?: Array<{ title?: unknown; url?: unknown; content?: unknown }> };
  try {
    body = await res.json();
  } catch (e) {
    console.error(`[webSearch] Tavily returned unparseable JSON for "${query.slice(0, 60)}":`, e);
    return { results: [], error: "unparseable" };
  }
  if (!Array.isArray(body?.results)) {
    console.error(`[webSearch] Tavily response had no results array for "${query.slice(0, 60)}"`);
    return { results: [], error: "no_results" };
  }

  const out: WebSearchResult[] = [];
  for (const row of body.results) {
    if (typeof row?.url !== "string" || !row.url) continue;
    out.push({
      url: row.url,
      title: typeof row.title === "string" ? row.title : "",
      snippet: typeof row.content === "string" ? row.content : "",
    });
  }
  return { results: out };
}
