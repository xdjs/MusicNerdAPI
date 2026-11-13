import { embedMany } from "ai";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { EMBED_BATCH, EMBEDDING_DIMENSIONS } from "@/lib/units/types";

/**
 * Embeds unit texts through the AI Gateway, `EMBED_BATCH` at a time.
 *
 * @param texts - The texts to embed.
 * @param opts - An abort signal forwarded to every model call.
 * @returns One vector per text, in the same order as `texts`.
 * @throws If the model returns a different number of vectors than texts, or a vector that is not `EMBEDDING_DIMENSIONS` long.
 */
export async function embedUnits(
  texts: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH) {
    const batch = texts.slice(start, start + EMBED_BATCH);
    const { embeddings } = await embedMany({
      model: MODEL_EMBEDDING,
      values: batch,
      abortSignal: opts.signal,
    });
    // Vectors are matched to texts by position, so a dropped item would shift every later one.
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`,
      );
    }
    for (const vector of embeddings) {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`,
        );
      }
      vectors.push(vector);
    }
  }
  return vectors;
}
