import { generateText } from "@/lib/ai/generateText";
import {
  FUN_FACT_INSTRUCTIONS,
  FUN_FACT_MODEL_TIMEOUT_MS,
  FUN_FACT_TEMPERATURE,
} from "@/lib/funFacts/const";

/**
 * Writes the fun fact with the default model through the gateway, as in
 * MusicNerdWeb: the writer instructions, temperature 0.8, and a 15 s bound.
 *
 * @param prompt - The assembled prompt.
 * @returns The fact's text; empty when the model returned none. Rejects with
 * `Gemini timeout` when the bound runs out.
 */
export async function generateFunFact(prompt: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      generateText({
        prompt,
        instructions: FUN_FACT_INSTRUCTIONS,
        temperature: FUN_FACT_TEMPERATURE,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Gemini timeout")), FUN_FACT_MODEL_TIMEOUT_MS);
      }),
    ]);
    return response.text ?? "";
  } finally {
    clearTimeout(timer);
  }
}
