import type { KnowledgeSnapshot } from "@/lib/knowledge/types";
import { loadArtistKnowledge } from "@/lib/knowledge/loadArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { readKnowledgePassage } from "@/lib/knowledge/readKnowledgePassage";
import type { KnowledgeToolConfig } from "./types";
/** Read a diverse, bounded set of saved originals plus a locator catalogue; never scrape. */
export async function fetchInterviewArtistContext(
  config: KnowledgeToolConfig,
  savedSnapshot?: KnowledgeSnapshot,
  excludedSourceIds: ReadonlySet<string> = new Set(),
  previouslyCitedSourceIds: ReadonlySet<string> = new Set(),
) {
  const snapshot = savedSnapshot ?? (await loadArtistKnowledge(config.artistId, config.userId));
  const readable = snapshot.sources.filter(
    source => source.text.trim() && !excludedSourceIds.has(source.metadata.sourceId),
  );
  const unseen = readable.filter(source => !previouslyCitedSourceIds.has(source.metadata.sourceId));
  const preferred = unseen.length >= 3 ? unseen : readable;
  const substantive = preferred.filter(source => source.text.trim().length >= 120);
  const evidencePool = substantive.length >= 3 ? substantive : preferred;
  const kinds = ["vault", "social_caption", "reel_transcript"] as const;
  const pools = kinds.map(kind =>
    evidencePool
      .filter(source => source.metadata.kind === kind)
      .sort((a, b) => b.text.length - a.text.length),
  );
  const selected: typeof readable = [];
  // Prefer substantive original passages within each type, rather than letting
  // numerous short social reactions exhaust the first evidence window.
  while (selected.length < 9 && pools.some(pool => pool.length)) {
    for (const pool of pools) {
      const source = pool.shift();
      if (source) selected.push(source);
      if (selected.length === 9) break;
    }
  }
  const originals = selected.map(source =>
    readKnowledgePassage(source, {
      operation: "read",
      sourceId: source.metadata.sourceId,
      revision: source.metadata.revision,
      start: 0,
      maxChars: 2400,
    }),
  );
  const catalogue = snapshot.sources.slice(0, 60).map(source => ({
    sourceId: source.metadata.sourceId,
    kind: source.metadata.kind,
    title: source.metadata.title?.slice(0, 160) ?? null,
    publishedAt: source.metadata.publishedAt,
    readable: !!source.text.trim(),
  }));
  return {
    brief: queryArtistKnowledge(snapshot, { operation: "brief" }),
    catalogue,
    catalogueTruncated: snapshot.sources.length > catalogue.length,
    originals,
    coverage: { totalSources: snapshot.sources.length, openedSources: originals.length },
  };
}
