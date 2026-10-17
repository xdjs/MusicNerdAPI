import type { KnowledgeSnapshot } from "@/lib/knowledge/types";
import { loadArtistKnowledge } from "@/lib/knowledge/loadArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { readKnowledgePassage } from "@/lib/knowledge/readKnowledgePassage";
import type { KnowledgeToolConfig } from "./types";
/** Read a diverse, bounded set of saved originals plus a locator catalogue; never scrape. */
export async function fetchInterviewArtistContext(
  config: KnowledgeToolConfig,
  savedSnapshot?: KnowledgeSnapshot,
) {
  const snapshot = savedSnapshot ?? (await loadArtistKnowledge(config.artistId, config.userId));
  const readable = snapshot.sources.filter(source => source.text.trim());
  const kinds = ["vault", "social_caption", "reel_transcript"] as const;
  const pools = kinds.map(kind => readable.filter(source => source.metadata.kind === kind));
  const selected: typeof readable = [];
  // Alternate ends within each source type so a prolific recent social feed cannot
  // displace all older interviews, biography or transcript context.
  let oldest = false;
  while (selected.length < 9 && pools.some(pool => pool.length)) {
    for (const pool of pools) {
      const source = oldest ? pool.pop() : pool.shift();
      if (source) selected.push(source);
      if (selected.length === 9) break;
    }
    oldest = !oldest;
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
