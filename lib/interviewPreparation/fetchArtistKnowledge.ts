import { knowledgeInputSchemas } from "@/lib/knowledge/knowledgeSchemas";
import { loadArtistKnowledge } from "@/lib/knowledge/loadArtistKnowledge";
import { readArtistKnowledge } from "@/lib/knowledge/readArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import type { KnowledgeSnapshot, KnowledgeQuery } from "@/lib/knowledge/types";
import type { KnowledgeToolConfig, KnowledgeResults } from "./types";
/** Internal worker reads still reauthorize the original actor; no bearer is persisted. */
export async function fetchArtistKnowledge<K extends keyof KnowledgeResults>(
  config: KnowledgeToolConfig,
  operation: K,
  input: unknown,
  signal?: AbortSignal,
  savedSnapshot?: KnowledgeSnapshot,
): Promise<KnowledgeResults[K]> {
  signal?.throwIfAborted();
  const query = { operation, ...knowledgeInputSchemas[operation].parse(input) } as KnowledgeQuery;
  const result = savedSnapshot
    ? queryArtistKnowledge(savedSnapshot, query)
    : query.operation === "read"
      ? await readArtistKnowledge(config.artistId, config.userId, query)
      : queryArtistKnowledge(await loadArtistKnowledge(config.artistId, config.userId), query);
  signal?.throwIfAborted();
  return result as KnowledgeResults[K];
}
