import { TAVILY_EXTRACT_ENDPOINT } from "@/lib/search/const";
import { isChallengeText } from "@/lib/sourceExtraction/isChallengeText";

const MAX_CHARS = 50_000;

/**
 * Reads one public page's text through Tavily's extract endpoint (basic depth, plain text). Used
 * only after our own fetcher was refused or found no text (#1693). Failures are logged by kind
 * alone: the link is never logged.
 *
 * @param url - The page.
 * @param budgetMs - Time left; Tavily's own timeout is kept inside it (1–10 s).
 * @param apiKey - `TAVILY_API_KEY`.
 * @returns The text, capped at 50,000 characters, or null when Tavily could not read the page.
 */
export async function extractWithTavily(
  url: string,
  budgetMs: number,
  apiKey: string,
): Promise<{ text: string; truncated: boolean; resolvedUrl: string } | null> {
  const timeout = Math.max(1, Math.min(10, Math.floor(budgetMs / 1000)));
  const res = await fetch(TAVILY_EXTRACT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ urls: [url], extract_depth: "basic", format: "text", timeout }),
    signal: AbortSignal.timeout(Math.max(1000, budgetMs)),
  }).catch(() => null);
  if (!res) {
    console.error("[sourceExtraction] Tavily extract did not respond (timeout or network)");
    return null;
  }
  if (!res.ok) {
    // 401 bad key, 429 rate limit, 432 plan exhausted: otherwise these read like "no text".
    console.error(`[sourceExtraction] Tavily extract HTTP ${res.status}`);
    return null;
  }
  let body: { results?: Array<{ url?: unknown; raw_content?: unknown }> };
  try {
    body = await res.json();
  } catch {
    console.error("[sourceExtraction] Tavily extract returned unparseable JSON");
    return null;
  }
  const row = Array.isArray(body?.results) ? body.results[0] : undefined;
  const raw = typeof row?.raw_content === "string" ? row.raw_content : "";
  const clean = raw
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean || isChallengeText(clean)) return null;
  let end = Math.min(MAX_CHARS, clean.length);
  if (end < clean.length && /[\uD800-\uDBFF]/.test(clean[end - 1])) end--;
  return {
    text: clean.slice(0, end),
    truncated: end < clean.length,
    resolvedUrl: typeof row?.url === "string" && row.url ? row.url : url,
  };
}
