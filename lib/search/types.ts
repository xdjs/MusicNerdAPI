/** One search hit. */
export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

/** What a caller can ask of `webSearch`. */
export interface WebSearchOptions {
  /** Domains to restrict results to, passed through to Tavily. */
  includeDomains?: string[];
  maxResults?: number;
  /** A durable job must tell a failed search from a successful empty one. */
  throwOnError?: boolean;
}

/** The options Tavily gets, with defaults filled in. */
export type ResolvedWebSearchOptions = Required<Omit<WebSearchOptions, "throwOnError">>;

/** What the provider hands back: the rows, and on a degrade-to-[] path, the kind of failure. */
export type ProviderOutcome = { results: WebSearchResult[]; error?: string };

/** The fields of the one `[websearch]` line logged per call. */
export type WebSearchLogFields = {
  provider: string;
  query: string;
  domains: number;
  results: number;
  ms: number;
  /** Why the call degraded to []: no_key, no_response, http_<status>, unparseable, no_results, threw. */
  error?: string;
};
