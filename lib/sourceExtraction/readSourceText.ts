import { extractWithTavily } from "@/lib/sourceExtraction/extractWithTavily";
import { fetchSourceText } from "@/lib/sourceExtraction/fetchSourceText";
import type { FetchedSource } from "@/lib/sourceExtraction/types";

/** Direct-fetch results worth a second try: the site refused us, or showed a gate, or no text. */
function refusedOrEmpty(result: FetchedSource): boolean {
  if (result.status === "empty") return true;
  // A null or redirect status means we refused the link ourselves (private address, bad scheme,
  // redirect to one): never hand those to a third party.
  return result.status === "blocked" && [200, 401, 403, 429].includes(result.httpStatus ?? 0);
}

/**
 * Reads an approved link's page: our own fetcher first, then Tavily's extract when the site refused
 * us (401/403/429 or a challenge page) or the page had no text (#1693). The result says which
 * reader got the text. Tavily gives no publication date or page image, so those are null.
 *
 * @param url - The page.
 * @param budgetMs - Time for both tries together.
 * @param apiKey - `TAVILY_API_KEY`; without it there is no second try.
 * @returns The fetch result.
 */
export async function readSourceText(
  url: string,
  budgetMs: number,
  apiKey: string = process.env.TAVILY_API_KEY ?? "",
): Promise<FetchedSource> {
  const started = Date.now();
  const direct = await fetchSourceText(url, budgetMs);
  if (direct.status === "ready") return { ...direct, reader: "direct" };
  const left = budgetMs - (Date.now() - started);
  if (!apiKey || left < 2000 || !refusedOrEmpty(direct)) return direct;
  const extracted = await extractWithTavily(url, left, apiKey);
  if (!extracted) return direct;
  return {
    ...direct,
    status: "ready",
    capturedAt: new Date().toISOString(),
    text: extracted.text,
    truncated: extracted.truncated,
    resolvedUrl: extracted.resolvedUrl,
    publishedAt: null,
    ogImage: null,
    reader: "tavily",
  };
}
