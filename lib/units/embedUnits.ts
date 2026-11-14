import { embedMany } from "ai";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { truncateForEmbedding } from "@/lib/units/truncateForEmbedding";
import { EMBED_BATCH, EMBED_BATCH_CHARS, EMBEDDING_DIMENSIONS } from "@/lib/units/types";

/**
 * Embeds unit texts through the AI Gateway, batches of at most `EMBED_BATCH` inputs and `EMBED_BATCH_CHARS` characters.
 * Each input is cut to `EMBED_INPUT_CHARS` for the model; the caller's text is unchanged.
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
  const inputs = texts.map(truncateForEmbedding);
  const vectors: number[][] = [];
  for (let start = 0; start < inputs.length;) {
    let end = start;
    let chars = 0;
    // A single input always fits: it is at most EMBED_INPUT_CHARS, below EMBED_BATCH_CHARS.
    while (
      end < inputs.length &&
      end - start < EMBED_BATCH &&
      (end === start || chars + inputs[end].length <= EMBED_BATCH_CHARS)
    ) {
      chars += inputs[end].length;
      end++;
    }
    const batch = inputs.slice(start, end);
    start = end;
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
