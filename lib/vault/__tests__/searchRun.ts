import type { DiscoveryResult, SearchRun } from "@/lib/vault/types";

/** A fresh run for Grimes, with overrides. */
export function searchRun(overrides: Partial<SearchRun> = {}): SearchRun {
  return {
    artistId: "a1",
    artistName: "Grimes",
    artist: { id: "a1", name: "Grimes", spotify: "sp1" },
    deadline: Number.POSITIVE_INFINITY,
    requireComplete: false,
    saved: [],
    existingUrls: new Set(),
    verifiedHandles: new Set(),
    indexLinks: new Set(),
    accountCandidates: [],
    hubCandidates: [],
    counts: { skipped: 0, dropped: 0, rejectedSkips: 0 },
    provisional: new Set(),
    ...overrides,
  };
}

/** A search hit. */
export function hit(url: string, title = "A Grimes Interview"): DiscoveryResult {
  return { url, title, snippet: "s", type: "article" };
}

/** A page that verifies: 200, plenty of body text, and it names the artist. */
export const GOOD_BODY = "Grimes gave a long interview about her new record. ".repeat(20);
export const goodPage = {
  title: "A",
  snippet: "s",
  extractedText: GOOD_BODY,
  fullText: GOOD_BODY,
  status: 200,
};
