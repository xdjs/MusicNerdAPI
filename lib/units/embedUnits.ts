import { embedMany } from "ai";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { EmbeddingInputError } from "@/lib/units/EmbeddingInputError";
import { isEmbeddingInputError } from "@/lib/units/isEmbeddingInputError";
import { truncateForEmbedding } from "@/lib/units/truncateForEmbedding";
import { EMBED_BATCH, EMBED_BATCH_CHARS, EMBEDDING_DIMENSIONS } from "@/lib/units/types";

/** Embeds `inputs[from, to)`; a batch of several inputs that fails with an input error (see `isEmbeddingInputError`) is split in halves, any other failure is rethrown unchanged, a failing single input throws an `EmbeddingInputError`. */
async function embedRange(
  inputs: string[],
  from: number,
  to: number,
  signal: AbortSignal | undefined,
): Promise<number[][]> {
  const batch = inputs.slice(from, to);
  let embeddings: number[][];
  try {
    ({ embeddings } = await embedMany({
      model: MODEL_EMBEDDING,
      values: batch,
      abortSignal: signal,
    }));
  } catch (error) {
    if (signal?.aborted || !isEmbeddingInputError(error)) throw error;
    if (batch.length === 1) throw new EmbeddingInputError(from, inputs.length, error);
    const mid = from + Math.ceil(batch.length / 2);
    return [
      ...(await embedRange(inputs, from, mid, signal)),
      ...(await embedRange(inputs, mid, to, signal)),
    ];
  }
  // Vectors are matched to texts by position, so a dropped item would shift every later one.
  if (embeddings.length !== batch.length) {
    throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`);
  }
  for (const vector of embeddings) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`,
      );
    }
  }
  return embeddings;
}

/**
 * Embeds unit texts through the AI Gateway, batches of at most `EMBED_BATCH` inputs and `EMBED_BATCH_CHARS` characters.
 * Each input is cut to `EMBED_INPUT_CHARS` for the model; the caller's text is unchanged.
 *
 * @param texts - The texts to embed.
 * @param opts - An abort signal forwarded to every model call.
 * @returns One vector per text, in the same order as `texts`.
 * @throws An `EmbeddingInputError` when a single input still fails with an input error after its batch was split; any other provider failure unchanged, without splitting; otherwise if the model returns a different number of vectors than texts, or a vector that is not `EMBEDDING_DIMENSIONS` long.
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
    vectors.push(...(await embedRange(inputs, start - batch.length, start, opts.signal)));
  }
  return vectors;
}
