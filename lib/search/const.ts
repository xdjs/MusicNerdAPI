/** The only provider. MusicNerdWeb's provider switch had one entry; Exa was never built (#1340). */
export const WEB_SEARCH_PROVIDER = "tavily";

export const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/** Per-request timeout, short so a hung provider can't eat a caller's budget. */
export const REQUEST_TIMEOUT_MS = 6_000;

export const DEFAULT_MAX_RESULTS = 5;
