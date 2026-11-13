import { embed } from "ai";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { EMBEDDING_DIMENSIONS } from "@/lib/units/types";

/**
 * Embeds one search query with the model the units were embedded with.
 *
 * @param text - The query.
 * @param opts - An abort signal forwarded to the model call.
 * @throws If the vector is not `EMBEDDING_DIMENSIONS` long.
 */
export async function embedQuery(
  text: string,
  opts: { signal?: AbortSignal } = {},
): Promise<number[]> {
  const { embedding } = await embed({
    model: MODEL_EMBEDDING,
    value: text,
    abortSignal: opts.signal,
  });
  if (embedding.length !== EMBEDDING_DIMENSIONS)
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
    );
  return embedding;
}
